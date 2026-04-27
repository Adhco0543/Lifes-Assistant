import type { FirebaseApp } from "firebase/app";
import { getApp, getApps, initializeApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit as queryLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

export interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  edited?: boolean;
  tags?: string[];
  starred?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  businessContext?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  tags?: string[];
  archived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  businessType?: string;
  businessName?: string;
  createdAt: number;
  updatedAt: number;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

class FirebaseBackend {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
      console.warn("Firebase config is missing. Firebase features will be disabled.");
      this.initialized = true;
      return;
    }

    const existingApp = getApps().find((app) => app.name === "[DEFAULT]");

    this.app = existingApp ?? initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.initialized = true;
  }

  isAvailable(): boolean {
    return Boolean(this.auth && this.db);
  }

  getCurrentUser(): User | null {
    return this.auth?.currentUser ?? null;
  }

  private async getServices(): Promise<{ auth: Auth; db: Firestore }> {
    await this.initialize();

    if (!this.auth || !this.db) {
      throw new Error("Firebase is not initialized. Check your .env.local file.");
    }

    return {
      auth: this.auth,
      db: this.db,
    };
  }

  private getUserId(): string {
    return this.auth?.currentUser?.uid ?? "local-user";
  }

  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    const { auth, db } = await this.getServices();

    const result = await createUserWithEmailAndPassword(auth, email, password);

    if (displayName) {
      await updateProfile(result.user, { displayName });
    }

    const now = Date.now();

    await setDoc(
      doc(db, "users", result.user.uid),
      {
        id: result.user.uid,
        email: result.user.email ?? email,
        displayName: displayName ?? result.user.displayName ?? "",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return result.user;
  }

  async login(email: string, password: string): Promise<User> {
    const { auth } = await this.getServices();
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  async logout(): Promise<void> {
    const { auth } = await this.getServices();
    await signOut(auth);
  }

  async createConversation(title = "New Chat", businessContext?: string): Promise<string> {
    const { db } = await this.getServices();
    const userId = this.getUserId();
    const now = Date.now();

    const conversationRef = await addDoc(collection(db, "users", userId, "conversations"), {
      userId,
      title,
      businessContext: businessContext ?? "",
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      archived: false,
    });

    return conversationRef.id;
  }

  async getConversations(maxCount = 25): Promise<Conversation[]> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    const conversationsQuery = query(
      collection(db, "users", userId, "conversations"),
      orderBy("updatedAt", "desc"),
      queryLimit(maxCount)
    );

    const snapshot = await getDocs(conversationsQuery);

    return snapshot.docs.map((item) => {
      const data = item.data();

      return {
        id: item.id,
        userId: data.userId ?? userId,
        title: data.title ?? "New Chat",
        businessContext: data.businessContext ?? "",
        createdAt: data.createdAt ?? Date.now(),
        updatedAt: data.updatedAt ?? Date.now(),
        messageCount: data.messageCount ?? 0,
        tags: data.tags ?? [],
        archived: data.archived ?? false,
        metadata: data.metadata ?? {},
      };
    });
  }

  onConversationsChange(callback: (conversations: Conversation[]) => void): () => void {
    if (!this.db) {
      return () => {};
    }

    const userId = this.getUserId();

    const conversationsQuery = query(
      collection(this.db, "users", userId, "conversations"),
      orderBy("updatedAt", "desc"),
      queryLimit(25)
    );

    return onSnapshot(conversationsQuery, (snapshot) => {
      const conversations = snapshot.docs.map((item) => {
        const data = item.data();

        return {
          id: item.id,
          userId: data.userId ?? userId,
          title: data.title ?? "New Chat",
          businessContext: data.businessContext ?? "",
          createdAt: data.createdAt ?? Date.now(),
          updatedAt: data.updatedAt ?? Date.now(),
          messageCount: data.messageCount ?? 0,
          tags: data.tags ?? [],
          archived: data.archived ?? false,
          metadata: data.metadata ?? {},
        };
      });

      callback(conversations);
    });
  }

  async saveMessage(message: ChatMessage): Promise<void> {
    const { db } = await this.getServices();

    if (!message.conversationId || message.conversationId === "local") {
      return;
    }

    const userId = this.getUserId();
    const now = Date.now();

    await setDoc(
      doc(db, "users", userId, "conversations", message.conversationId, "messages", message.id),
      message,
      { merge: true }
    );

    await setDoc(
      doc(db, "users", userId, "conversations", message.conversationId),
      {
        updatedAt: now,
        messageCount: increment(1),
      },
      { merge: true }
    );
  }

  async getMessages(conversationId: string, maxCount = 100): Promise<ChatMessage[]> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    const messagesQuery = query(
      collection(db, "users", userId, "conversations", conversationId, "messages"),
      orderBy("timestamp", "asc"),
      queryLimit(maxCount)
    );

    const snapshot = await getDocs(messagesQuery);

    return snapshot.docs.map((item) => {
      const data = item.data();

      return {
        id: data.id ?? item.id,
        userId: data.userId ?? userId,
        conversationId: data.conversationId ?? conversationId,
        role: data.role ?? "assistant",
        content: data.content ?? "",
        timestamp: data.timestamp ?? Date.now(),
        edited: data.edited ?? false,
        tags: data.tags ?? [],
        starred: data.starred ?? false,
      };
    });
  }

  async searchMessages(term: string): Promise<ChatMessage[]> {
    const normalizedTerm = term.toLowerCase().trim();

    if (!normalizedTerm) {
      return [];
    }

    const conversations = await this.getConversations(20);
    const results: ChatMessage[] = [];

    for (const conversation of conversations) {
      const messages = await this.getMessages(conversation.id, 100);
      const matches = messages.filter((message) =>
        message.content.toLowerCase().includes(normalizedTerm)
      );

      results.push(...matches);
    }

    return results.slice(0, 100);
  }

  async trackEvent(eventName: string, data: Record<string, unknown> = {}): Promise<void> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    await addDoc(collection(db, "users", userId, "events"), {
      eventName,
      data,
      createdAt: Date.now(),
    });
  }

  async saveDraft(kind: "quote" | "email" | string, data: Record<string, unknown>): Promise<void> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    await setDoc(
      doc(db, "users", userId, "drafts", kind),
      {
        kind,
        data,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }

  async getLatestDraft(kind: "quote" | "email" | string): Promise<Record<string, unknown> | null> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    const snapshot = await getDoc(doc(db, "users", userId, "drafts", kind));

    if (!snapshot.exists()) {
      return null;
    }

    return (snapshot.data().data as Record<string, unknown>) ?? null;
  }

  async saveBusinessRecord(kind: string, data: Record<string, unknown>): Promise<string> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    const recordRef = await addDoc(collection(db, "users", userId, "records"), {
      kind,
      data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return recordRef.id;
  }

  async getRecentBusinessRecords(maxCount = 25): Promise<Array<Record<string, unknown>>> {
    const { db } = await this.getServices();
    const userId = this.getUserId();

    const recordsQuery = query(
      collection(db, "users", userId, "records"),
      orderBy("updatedAt", "desc"),
      queryLimit(maxCount)
    );

    const snapshot = await getDocs(recordsQuery);

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    }));
  }
}

export const firebaseBackend = new FirebaseBackend();
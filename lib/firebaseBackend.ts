import {
  initializeApp,
  getApp,
  FirebaseApp,
} from 'firebase/app';
import {
  getAuth,
  Auth,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  Query,
  QuerySnapshot,
} from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

class FirebaseBackendService {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private db: Firestore | null = null;
  private currentUser: User | null = null;
  private isInitialized = false;
  private listeners: Map<string, () => void> = new Map();

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const config: FirebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      };

      // Check if config is valid
      if (!config.projectId) {
        console.warn('Firebase config not fully configured, using local storage mode');
        this.isInitialized = true;
        return;
      }

      try {
        this.app = getApp();
      } catch {
        this.app = initializeApp(config);
      }

      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);

      // Set up auth state listener
      onAuthStateChanged(this.auth, (user) => {
        this.currentUser = user;
      });

      this.isInitialized = true;
      console.log('[Firebase] Initialized successfully');
    } catch (error) {
      console.warn('[Firebase] Initialization failed, using local storage mode:', error);
      this.isInitialized = true;
    }
  }

  isAvailable(): boolean {
    return !!(this.db && this.auth && this.currentUser);
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    if (!this.isAvailable() || !this.currentUser) {
      return [];
    }

    try {
      const conversationsRef = collection(this.db!, 'conversations');
      const q = query(
        conversationsRef,
        where('userId', '==', this.currentUser.uid),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Conversation));
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  }

  async createConversation(
    title: string,
    context?: string
  ): Promise<string> {
    if (!this.isAvailable() || !this.currentUser) {
      return '';
    }

    try {
      const now = Date.now();
      const conversation: Omit<Conversation, 'id'> = {
        userId: this.currentUser.uid,
        title,
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(
        collection(this.db!, 'conversations'),
        conversation
      );

      return docRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return '';
    }
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await deleteDoc(doc(this.db!, 'conversations', conversationId));
      return true;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      return false;
    }
  }

  onConversationsChange(
    callback: (conversations: Conversation[]) => void
  ): () => void {
    if (!this.isAvailable() || !this.currentUser) {
      return () => {};
    }

    const conversationsRef = collection(this.db!, 'conversations');
    const q = query(
      conversationsRef,
      where('userId', '==', this.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Conversation));
      callback(conversations);
    });

    return unsubscribe;
  }

  // Messages
  async getMessages(
    conversationId: string,
    limitCount: number = 100
  ): Promise<ChatMessage[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const messagesRef = collection(
        this.db!,
        'conversations',
        conversationId,
        'messages'
      );
      const q = query(
        messagesRef,
        orderBy('timestamp', 'asc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ChatMessage));
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  }

  async saveMessage(message: ChatMessage): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const messageRef = doc(
        this.db!,
        'conversations',
        message.conversationId,
        'messages',
        message.id
      );

      await setDoc(messageRef, {
        ...message,
        timestamp: Timestamp.fromMillis(message.timestamp),
      });

      // Update conversation's updatedAt and messageCount
      const conversationRef = doc(this.db!, 'conversations', message.conversationId);
      const convDoc = await getDoc(conversationRef);

      if (convDoc.exists()) {
        const messageCount = (convDoc.data().messageCount || 0) + 1;
        await updateDoc(conversationRef, {
          updatedAt: Date.now(),
          messageCount,
        });
      }

      return true;
    } catch (error) {
      console.error('Error saving message:', error);
      return false;
    }
  }

  async searchMessages(term: string): Promise<ChatMessage[]> {
    if (!this.isAvailable() || !this.currentUser) {
      return [];
    }

    try {
      const conversationsRef = collection(this.db!, 'conversations');
      const conversations = await getDocs(
        query(
          conversationsRef,
          where('userId', '==', this.currentUser.uid)
        )
      );

      const allMessages: ChatMessage[] = [];

      for (const convDoc of conversations.docs) {
        const messagesRef = collection(
          this.db!,
          'conversations',
          convDoc.id,
          'messages'
        );
        const snapshot = await getDocs(messagesRef);

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.content.toLowerCase().includes(term.toLowerCase())) {
            allMessages.push({
              id: doc.id,
              ...data,
            } as ChatMessage);
          }
        });
      }

      return allMessages.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  // Events / Analytics
  async trackEvent(
    eventName: string,
    properties?: Record<string, any>
  ): Promise<boolean> {
    if (!this.isAvailable() || !this.currentUser) {
      return false;
    }

    try {
      const eventsRef = collection(this.db!, 'events');
      await addDoc(eventsRef, {
        userId: this.currentUser.uid,
        eventName,
        properties: properties || {},
        timestamp: Timestamp.now(),
      });

      return true;
    } catch (error) {
      console.error('Error tracking event:', error);
      return false;
    }
  }

  // User data
  async getUserData(key: string): Promise<any> {
    if (!this.isAvailable() || !this.currentUser) {
      return null;
    }

    try {
      const userRef = doc(this.db!, 'users', this.currentUser.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        return snapshot.data()[key];
      }

      return null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async setUserData(key: string, value: any): Promise<boolean> {
    if (!this.isAvailable() || !this.currentUser) {
      return false;
    }

    try {
      const userRef = doc(this.db!, 'users', this.currentUser.uid);
      await setDoc(userRef, { [key]: value }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error setting user data:', error);
      return false;
    }
  }

  // Cleanup
  dispose(): void {
    // Unsubscribe all listeners
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }
}

// Export singleton instance
export const firebaseBackend = new FirebaseBackendService();

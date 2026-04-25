import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/public/src/lib/firebase";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  metadata?: {
    sentiment?: "positive" | "neutral" | "negative";
    topics?: string[];
    actionItems?: string[];
  };
}

export interface Conversation {
  id?: string;
  userId: string;
  messages: ConversationMessage[];
  title?: string;
  summary?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  archived?: boolean;
}

export class ConversationManager {
  static async startNewConversation(userId: string, title?: string): Promise<string> {
    try {
      const conversation: Conversation = {
        userId,
        messages: [],
        title: title || `Conversation - ${new Date().toLocaleDateString()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        archived: false,
      };

      const docRef = await addDoc(collection(db, "conversations"), {
        ...conversation,
        createdAt: Timestamp.fromDate(conversation.createdAt),
        updatedAt: Timestamp.fromDate(conversation.updatedAt),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error starting new conversation:", error);
      throw error;
    }
  }

  static async addMessageToConversation(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    metadata?: ConversationMessage["metadata"]
  ): Promise<void> {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationSnap = await getDocs(
        query(collection(db, "conversations"), where("__name__", "==", conversationId))
      );

      if (conversationSnap.empty) {
        throw new Error("Conversation not found");
      }

      const message: ConversationMessage = {
        role,
        content,
        timestamp: new Date(),
        metadata,
      };

      // Get existing conversation and add new message
      const existingDoc = conversationSnap.docs[0];
      const existingData = existingDoc.data() as Conversation;
      const updatedMessages = [
        ...existingData.messages,
        {
          ...message,
          timestamp: Timestamp.fromDate(message.timestamp),
        },
      ];

      await updateDoc(conversationRef, {
        messages: updatedMessages,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error adding message to conversation:", error);
      throw error;
    }
  }

  static async getRecentConversations(userId: string, limitCount: number = 5): Promise<Conversation[]> {
    try {
      // Simple query: just get by userId, filter and sort in memory to avoid composite indexes
      const q = query(
        collection(db, "conversations"),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(q);

      const conversations = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate?.(),
        } as Conversation;
      });

      // Filter and sort in memory
      return conversations
        .filter(c => !c.archived)
        .sort((a, b) => (b.updatedAt?.getTime?.() || 0) - (a.updatedAt?.getTime?.() || 0))
        .slice(0, limitCount);
    } catch (error) {
      console.error("Error fetching recent conversations:", error);
      throw error;
    }
  }

  static async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const q = query(
        collection(db, "conversations"),
        where("__name__", "==", conversationId)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        lastAccessedAt: data.lastAccessedAt?.toDate?.(),
      } as Conversation;
    } catch (error) {
      console.error("Error fetching conversation:", error);
      return null;
    }
  }

  static async getAllConversations(userId: string): Promise<Conversation[]> {
    try {
      const constraints: QueryConstraint[] = [
        where("userId", "==", userId),
        orderBy("updatedAt", "desc"),
      ];

      const q = query(collection(db, "conversations"), ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
          lastAccessedAt: data.lastAccessedAt?.toDate?.(),
        } as Conversation;
      });
    } catch (error) {
      console.error("Error fetching all conversations:", error);
      return [];
    }
  }

  static async searchConversations(
    userId: string,
    searchTerm: string
  ): Promise<Conversation[]> {
    try {
      const allConversations = await this.getAllConversations(userId);

      return allConversations.filter((conv) => {
        const titleMatch = conv.title?.toLowerCase().includes(searchTerm.toLowerCase());
        const messageMatch = conv.messages?.some((msg) =>
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
        const tagMatch = conv.tags?.some((tag) =>
          tag.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return titleMatch || messageMatch || tagMatch;
      });
    } catch (error) {
      console.error("Error searching conversations:", error);
      return [];
    }
  }

  static async getConversationsByTags(userId: string, tags: string[]): Promise<Conversation[]> {
    try {
      const allConversations = await this.getAllConversations(userId);

      return allConversations.filter((conv) =>
        tags.some((tag) => conv.tags?.includes(tag))
      );
    } catch (error) {
      console.error("Error fetching conversations by tags:", error);
      return [];
    }
  }

  static async updateConversationTitle(
    conversationId: string,
    newTitle: string
  ): Promise<void> {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        title: newTitle,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating conversation title:", error);
      throw error;
    }
  }

  static async updateConversationTags(
    conversationId: string,
    tags: string[]
  ): Promise<void> {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        tags,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error updating conversation tags:", error);
      throw error;
    }
  }

  static async archiveConversation(conversationId: string): Promise<void> {
    try {
      const conversationRef = doc(db, "conversations", conversationId);
      await updateDoc(conversationRef, {
        archived: true,
        updatedAt: Timestamp.fromDate(new Date()),
      });
    } catch (error) {
      console.error("Error archiving conversation:", error);
      throw error;
    }
  }

  static async generateConversationSummary(conversation: Conversation): Promise<string> {
    const messageCount = conversation.messages.length;
    const firstMessage = conversation.messages[0]?.content.substring(0, 100) || "";
    const topics = Array.from(
      new Set(conversation.messages.flatMap((m) => m.metadata?.topics || []))
    );

    return `${conversation.title} - ${messageCount} messages. Topics: ${topics.join(", ") || "General"}. Started: ${conversation.createdAt.toLocaleDateString()}`;
  }

  static async extractConversationContext(conversation: Conversation, contextLength: number = 5): Promise<string> {
    const recentMessages = conversation.messages.slice(-contextLength);
    return recentMessages
      .map((msg) => `${msg.role === "user" ? "You" : "Assistant"}: ${msg.content}`)
      .join("\n");
  }
}

export default ConversationManager;

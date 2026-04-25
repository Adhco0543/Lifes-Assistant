import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/public/src/lib/firebase";

export interface UserMemoryProfile {
  userId: string;
  
  // Communication preferences
  preferredTone: "professional" | "casual" | "friendly" | "formal";
  communicationStyle: string; // e.g., "direct", "detailed", "concise"
  
  // Business context
  businessType: string; // e.g., "carpentry", "salon", "auto_repair"
  businessName: string;
  workingHours: {
    monday: { start: string; end: string } | null;
    tuesday: { start: string; end: string } | null;
    wednesday: { start: string; end: string } | null;
    thursday: { start: string; end: string } | null;
    friday: { start: string; end: string } | null;
    saturday: { start: string; end: string } | null;
    sunday: { start: string; end: string } | null;
  };
  
  // Common customers
  frequentCustomers: Array<{
    name: string;
    frequency: number; // times contacted
    lastContact: Date;
    preferredMethod: "email" | "phone" | "sms";
    notes: string;
  }>;
  
  // Common job types
  commonJobTypes: Array<{
    name: string;
    frequency: number;
    averagePrice: number;
    standardMaterials: string[];
    estimatedDuration: string;
  }>;
  
  // Materials & suppliers
  usualMaterials: string[];
  favoriteVendors: Array<{
    name: string;
    contact: string;
    category: string;
    notes: string;
  }>;
  
  // Quote preferences
  quoteStyle: {
    includeDescriptions: boolean;
    includeImages: boolean;
    includeTimeline: boolean;
    includePricingTiers: boolean;
    defaultDiscount: number;
    paymentTerms: string;
  };
  
  // Current state
  currentPriorities: Array<{
    priority: string;
    deadline?: Date;
    importance: "high" | "medium" | "low";
  }>;
  
  unfinishedConversations: Array<{
    conversationId: string;
    topic: string;
    lastMessage: string;
    lastUpdated: Date;
    status: "waiting_on_user" | "waiting_on_assistant" | "paused";
  }>;
  
  // Learning from behavior
  preferredTools: string[]; // tools they use most
  commonPainPoints: string[];
  goals: string[];
  
  // Assistant preferences
  autoTaskTypes: ("check_emails" | "find_jobs" | "follow_up" | "analyze_leads")[];
  requiresApprovalForTasks: ("generate_quote" | "send_email" | "create_material_list")[];
  preferredNotificationStyle: "silent" | "subtle" | "noticeable" | "prominent";
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastReview: Date;
}

export class UserMemoryProfileManager {
  static async createOrGetProfile(userId: string): Promise<UserMemoryProfile> {
    try {
      const profileRef = doc(db, "user_memory_profiles", userId);
      const snapshot = await getDoc(profileRef);

      if (snapshot.exists()) {
        return this.deserializeProfile(snapshot.data());
      }

      // Create default profile
      const defaultProfile: UserMemoryProfile = {
        userId,
        preferredTone: "friendly",
        communicationStyle: "natural",
        businessType: "",
        businessName: "",
        workingHours: {
          monday: null,
          tuesday: null,
          wednesday: null,
          thursday: null,
          friday: null,
          saturday: null,
          sunday: null,
        },
        frequentCustomers: [],
        commonJobTypes: [],
        usualMaterials: [],
        favoriteVendors: [],
        quoteStyle: {
          includeDescriptions: true,
          includeImages: true,
          includeTimeline: true,
          includePricingTiers: false,
          defaultDiscount: 0,
          paymentTerms: "Net 30",
        },
        currentPriorities: [],
        unfinishedConversations: [],
        preferredTools: [],
        commonPainPoints: [],
        goals: [],
        autoTaskTypes: ["check_emails", "find_jobs", "analyze_leads"],
        requiresApprovalForTasks: ["generate_quote", "send_email"],
        preferredNotificationStyle: "subtle",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastReview: new Date(),
      };

      await setDoc(profileRef, {
        ...defaultProfile,
        createdAt: Timestamp.fromDate(defaultProfile.createdAt),
        updatedAt: Timestamp.fromDate(defaultProfile.updatedAt),
        lastReview: Timestamp.fromDate(defaultProfile.lastReview),
      });

      return defaultProfile;
    } catch (error) {
      console.error("Error getting profile:", error);
      throw error;
    }
  }

  static async updateProfile(userId: string, updates: Partial<UserMemoryProfile>): Promise<void> {
    try {
      const profileRef = doc(db, "user_memory_profiles", userId);

      const updateData: any = {
        ...updates,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      // Convert Date objects to Timestamps
      if (updates.createdAt) updateData.createdAt = Timestamp.fromDate(updates.createdAt);
      if (updates.lastReview) updateData.lastReview = Timestamp.fromDate(updates.lastReview);
      if (updates.frequentCustomers) {
        updateData.frequentCustomers = updates.frequentCustomers.map((c) => ({
          ...c,
          lastContact: Timestamp.fromDate(c.lastContact),
        }));
      }
      if (updates.unfinishedConversations) {
        updateData.unfinishedConversations = updates.unfinishedConversations.map((c) => ({
          ...c,
          lastUpdated: Timestamp.fromDate(c.lastUpdated),
          deadline: c.deadline ? Timestamp.fromDate(c.deadline) : null,
        }));
      }
      if (updates.currentPriorities) {
        updateData.currentPriorities = updates.currentPriorities.map((p) => ({
          ...p,
          deadline: p.deadline ? Timestamp.fromDate(p.deadline) : null,
        }));
      }

      await updateDoc(profileRef, updateData);
    } catch (error) {
      console.error("Error updating profile:", error);
      throw error;
    }
  }

  static async addFrequentCustomer(
    userId: string,
    customer: UserMemoryProfile["frequentCustomers"][0]
  ): Promise<void> {
    try {
      const profile = await this.createOrGetProfile(userId);
      
      const existingIndex = profile.frequentCustomers.findIndex(
        (c) => c.name.toLowerCase() === customer.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        profile.frequentCustomers[existingIndex].frequency += 1;
        profile.frequentCustomers[existingIndex].lastContact = new Date();
      } else {
        profile.frequentCustomers.push(customer);
      }

      await this.updateProfile(userId, { frequentCustomers: profile.frequentCustomers });
    } catch (error) {
      console.error("Error adding customer:", error);
    }
  }

  static async addCommonJobType(
    userId: string,
    jobType: UserMemoryProfile["commonJobTypes"][0]
  ): Promise<void> {
    try {
      const profile = await this.createOrGetProfile(userId);
      
      const existingIndex = profile.commonJobTypes.findIndex(
        (j) => j.name.toLowerCase() === jobType.name.toLowerCase()
      );

      if (existingIndex >= 0) {
        profile.commonJobTypes[existingIndex].frequency += 1;
      } else {
        profile.commonJobTypes.push(jobType);
      }

      // Sort by frequency
      profile.commonJobTypes.sort((a, b) => b.frequency - a.frequency);

      await this.updateProfile(userId, { commonJobTypes: profile.commonJobTypes });
    } catch (error) {
      console.error("Error adding job type:", error);
    }
  }

  static async updateUnfinishedConversation(
    userId: string,
    conversationId: string,
    updates: {
      lastMessage?: string;
      status?: "waiting_on_user" | "waiting_on_assistant" | "paused";
    }
  ): Promise<void> {
    try {
      const profile = await this.createOrGetProfile(userId);

      const convIndex = profile.unfinishedConversations.findIndex(
        (c) => c.conversationId === conversationId
      );

      if (convIndex >= 0) {
        if (updates.lastMessage) {
          profile.unfinishedConversations[convIndex].lastMessage = updates.lastMessage;
        }
        if (updates.status) {
          profile.unfinishedConversations[convIndex].status = updates.status;
        }
        profile.unfinishedConversations[convIndex].lastUpdated = new Date();
      }

      await this.updateProfile(userId, {
        unfinishedConversations: profile.unfinishedConversations,
      });
    } catch (error) {
      console.error("Error updating conversation:", error);
    }
  }

  static async addCurrentPriority(
    userId: string,
    priority: UserMemoryProfile["currentPriorities"][0]
  ): Promise<void> {
    try {
      const profile = await this.createOrGetProfile(userId);
      
      const exists = profile.currentPriorities.some((p) => p.priority === priority.priority);
      if (!exists) {
        profile.currentPriorities.push(priority);
      }

      // Sort by importance
      const importanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      profile.currentPriorities.sort(
        (a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]
      );

      await this.updateProfile(userId, { currentPriorities: profile.currentPriorities });
    } catch (error) {
      console.error("Error adding priority:", error);
    }
  }

  static async getQuoteContext(userId: string): Promise<{
    commonJobTypes: string[];
    standardMaterials: string[];
    favoriteVendors: string[];
    style: UserMemoryProfile["quoteStyle"];
  }> {
    try {
      const profile = await this.createOrGetProfile(userId);

      return {
        commonJobTypes: profile.commonJobTypes.map((j) => j.name),
        standardMaterials: profile.usualMaterials,
        favoriteVendors: profile.favoriteVendors.map((v) => v.name),
        style: profile.quoteStyle,
      };
    } catch (error) {
      console.error("Error getting quote context:", error);
      return {
        commonJobTypes: [],
        standardMaterials: [],
        favoriteVendors: [],
        style: {
          includeDescriptions: true,
          includeImages: true,
          includeTimeline: true,
          includePricingTiers: false,
          defaultDiscount: 0,
          paymentTerms: "Net 30",
        },
      };
    }
  }

  static async getCustomerContext(
    userId: string,
    customerName: string
  ): Promise<UserMemoryProfile["frequentCustomers"][0] | null> {
    try {
      const profile = await this.createOrGetProfile(userId);
      return (
        profile.frequentCustomers.find(
          (c) => c.name.toLowerCase() === customerName.toLowerCase()
        ) || null
      );
    } catch (error) {
      console.error("Error getting customer context:", error);
      return null;
    }
  }

  static async isWorkingHours(userId: string): Promise<boolean> {
    try {
      const profile = await this.createOrGetProfile(userId);
      const now = new Date();
      const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
        now.getDay()
      ] as keyof UserMemoryProfile["workingHours"];

      const dayHours = profile.workingHours[dayName];
      if (!dayHours) return true; // If not set, assume always working

      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = dayHours.start.split(":").map(Number);
      const [endHour, endMin] = dayHours.end.split(":").map(Number);

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      return currentTime >= startTime && currentTime <= endTime;
    } catch (error) {
      console.error("Error checking working hours:", error);
      return true;
    }
  }

  private static deserializeProfile(data: any): UserMemoryProfile {
    return {
      userId: data.userId,
      preferredTone: data.preferredTone,
      communicationStyle: data.communicationStyle,
      businessType: data.businessType,
      businessName: data.businessName,
      workingHours: data.workingHours,
      frequentCustomers: (data.frequentCustomers || []).map((c: any) => ({
        ...c,
        lastContact: c.lastContact?.toDate?.() || new Date(),
      })),
      commonJobTypes: data.commonJobTypes || [],
      usualMaterials: data.usualMaterials || [],
      favoriteVendors: data.favoriteVendors || [],
      quoteStyle: data.quoteStyle,
      currentPriorities: (data.currentPriorities || []).map((p: any) => ({
        ...p,
        deadline: p.deadline?.toDate?.(),
      })),
      unfinishedConversations: (data.unfinishedConversations || []).map((c: any) => ({
        ...c,
        lastUpdated: c.lastUpdated?.toDate?.() || new Date(),
        deadline: c.deadline?.toDate?.(),
      })),
      preferredTools: data.preferredTools || [],
      commonPainPoints: data.commonPainPoints || [],
      goals: data.goals || [],
      autoTaskTypes: data.autoTaskTypes || [],
      requiresApprovalForTasks: data.requiresApprovalForTasks || [],
      preferredNotificationStyle: data.preferredNotificationStyle,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
      lastReview: data.lastReview?.toDate?.() || new Date(),
    };
  }
}

export default UserMemoryProfileManager;

import { Timestamp, doc, getDoc, setDoc, collection } from "firebase/firestore";
import { db } from "../public/src/lib/firebase";

export interface AutonomySettings {
  // Email settings
  emailBehavior: "ask" | "draft_only" | "auto_send";
  emailCategories: {
    customer: "ask" | "auto_draft" | "auto_send";
    followup: "ask" | "auto_draft" | "auto_send";
    invoice: "ask" | "auto_draft" | "auto_send";
  };

  // Quote settings
  quoteBehavior: "ask" | "auto_create" | "auto_send";
  autoSendQuotesUnder: number; // Auto-send quotes under this amount ($)

  // Job search settings
  jobSearchBehavior: "ask" | "auto_search" | "auto_apply";
  autoSearchFrequency: "daily" | "weekly" | "on_demand";
  autoApplyRules?: {
    minBudget?: number;
    maxDistance?: number;
    categories?: string[];
  };

  // Reminder/Follow-up settings
  autoFollowUpRules: {
    daysAfterQuote?: number;
    daysAfterNoResponse?: number;
    enabled: boolean;
  };

  // General settings
  backgroundMode: boolean; // Can assistant act when user is offline?
  backgroundModeBehavior: "silent" | "draft_only" | "auto_execute";

  // Approval settings
  autoTaskTypes: string[]; // Tasks that auto-execute without approval
  requiresApprovalForTasks: string[]; // Tasks that always need approval

  // Notification settings
  notifyOnApprovals: boolean;
  notifyOnAutoExecute: boolean;
  notifyOnErrors: boolean;
  notifyOnQuoteRequests: boolean;

  // Memory settings
  memoryRetention: "1_week" | "1_month" | "3_months" | "unlimited";
  clearHistoryFrequency: "never" | "weekly" | "monthly";

  // Safety settings
  dailyExecutionLimit: number; // Max tools executed per day
  requireConfirmationForLargeAmounts: number; // Always confirm over $X
  disableDuringHours?: {
    enabled: boolean;
    startTime?: string; // "18:00"
    endTime?: string; // "08:00"
  };

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastModifiedBy?: string;
}

export const DEFAULT_AUTONOMY_SETTINGS: AutonomySettings = {
  emailBehavior: "ask", // Safe default: ask before sending
  emailCategories: {
    customer: "ask",
    followup: "auto_draft",
    invoice: "ask",
  },

  quoteBehavior: "ask",
  autoSendQuotesUnder: 0, // Never auto-send by default

  jobSearchBehavior: "auto_search",
  autoSearchFrequency: "weekly",

  autoFollowUpRules: {
    daysAfterQuote: 7,
    daysAfterNoResponse: 3,
    enabled: false,
  },

  backgroundMode: true,
  backgroundModeBehavior: "auto_execute",

  autoTaskTypes: ["job_search", "materials", "customer_lookup"],
  requiresApprovalForTasks: ["email", "quote"],

  notifyOnApprovals: true,
  notifyOnAutoExecute: false,
  notifyOnErrors: true,
  notifyOnQuoteRequests: true,

  memoryRetention: "3_months",
  clearHistoryFrequency: "monthly",

  dailyExecutionLimit: 50,
  requireConfirmationForLargeAmounts: 10000,

  disableDuringHours: {
    enabled: false,
  },

  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

/**
 * Autonomy Settings Manager - manages user autonomy preferences
 */
export class AutonomySettingsManager {
  /**
   * Get user's autonomy settings
   */
  static async getSettings(userId: string): Promise<AutonomySettings> {
    try {
      const docRef = doc(collection(db, "users", userId, "settings"), "autonomy");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...DEFAULT_AUTONOMY_SETTINGS,
          ...data,
          createdAt: data.createdAt || Timestamp.now(),
          updatedAt: data.updatedAt || Timestamp.now(),
        } as AutonomySettings;
      }

      // Return defaults if not set
      return DEFAULT_AUTONOMY_SETTINGS;
    } catch (error) {
      console.error("Error getting autonomy settings:", error);
      return DEFAULT_AUTONOMY_SETTINGS;
    }
  }

  /**
   * Update user's autonomy settings
   */
  static async updateSettings(userId: string, settings: Partial<AutonomySettings>): Promise<void> {
    try {
      const docRef = doc(collection(db, "users", userId, "settings"), "autonomy");
      const current = await this.getSettings(userId);

      const updated: AutonomySettings = {
        ...current,
        ...settings,
        updatedAt: Timestamp.now(),
      };

      await setDoc(docRef, updated);
    } catch (error) {
      console.error("Error updating autonomy settings:", error);
      throw error;
    }
  }

  /**
   * Check if a tool can auto-execute
   */
  static canAutoExecute(toolName: string, settings: AutonomySettings): boolean {
    return settings.autoTaskTypes.includes(toolName);
  }

  /**
   * Check if a tool requires approval
   */
  static requiresApproval(toolName: string, settings: AutonomySettings): boolean {
    return settings.requiresApprovalForTasks.includes(toolName);
  }

  /**
   * Check if user is in "disable hours"
   */
  static isInDisableHours(settings: AutonomySettings): boolean {
    if (!settings.disableDuringHours?.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;

    const startTime = settings.disableDuringHours.startTime || "18:00";
    const endTime = settings.disableDuringHours.endTime || "08:00";

    // If range crosses midnight (e.g., 18:00-08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }

    // Normal range
    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Check if background mode allows action
   */
  static canRunInBackground(settings: AutonomySettings): boolean {
    return settings.backgroundMode;
  }

  /**
   * Check if amount requires confirmation
   */
  static requiresConfirmation(amount: number, settings: AutonomySettings): boolean {
    return amount >= settings.requireConfirmationForLargeAmounts;
  }

  /**
   * Get preset configurations
   */
  static getPresets() {
    return {
      conservative: {
        name: "Conservative",
        description: "Ask for approval on everything sensitive",
        settings: {
          emailBehavior: "ask" as const,
          quoteBehavior: "ask" as const,
          jobSearchBehavior: "auto_search" as const,
          backgroundMode: false,
          autoTaskTypes: [],
          requiresApprovalForTasks: ["email", "quote", "reminder", "calendar"],
        },
      },

      balanced: {
        name: "Balanced",
        description: "Auto-draft, ask before sending",
        settings: {
          emailBehavior: "draft_only" as const,
          quoteBehavior: "auto_create" as const,
          jobSearchBehavior: "auto_search" as const,
          backgroundMode: true,
          autoTaskTypes: ["job_search", "materials", "customer_lookup"],
          requiresApprovalForTasks: ["email", "quote"],
        },
      },

      aggressive: {
        name: "Aggressive",
        description: "Maximum automation, minimal interruption",
        settings: {
          emailBehavior: "auto_send" as const,
          quoteBehavior: "auto_send" as const,
          jobSearchBehavior: "auto_search" as const,
          backgroundMode: true,
          autoTaskTypes: [
            "email",
            "quote",
            "job_search",
            "materials",
            "customer_lookup",
            "reminder",
            "calendar",
          ],
          requiresApprovalForTasks: [],
        },
      },

      office_hours: {
        name: "Office Hours Only",
        description: "Only work during business hours",
        settings: {
          emailBehavior: "draft_only" as const,
          quoteBehavior: "auto_create" as const,
          jobSearchBehavior: "auto_search" as const,
          backgroundMode: false,
          disableDuringHours: {
            enabled: true,
            startTime: "18:00",
            endTime: "08:00",
          },
          autoTaskTypes: ["job_search", "materials", "customer_lookup"],
          requiresApprovalForTasks: ["email", "quote"],
        },
      },
    };
  }

  /**
   * Apply preset settings
   */
  static async applyPreset(
    userId: string,
    presetName: keyof ReturnType<typeof AutonomySettingsManager.getPresets>
  ): Promise<void> {
    const presets = this.getPresets();
    const preset = presets[presetName];

    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }

    await this.updateSettings(userId, preset.settings);
  }

  /**
   * Get autonomy rules summary
   */
  static getSummary(settings: AutonomySettings): string {
    const rules: string[] = [];

    if (settings.emailBehavior === "ask") {
      rules.push("📧 Ask before sending emails");
    } else if (settings.emailBehavior === "draft_only") {
      rules.push("📧 Auto-draft emails, ask before send");
    } else {
      rules.push("📧 Auto-send emails");
    }

    if (settings.quoteBehavior === "ask") {
      rules.push("📝 Ask before creating quotes");
    } else if (settings.quoteBehavior === "auto_create") {
      rules.push("📝 Auto-create quotes, ask before send");
    } else {
      rules.push("📝 Auto-send quotes");
    }

    if (settings.jobSearchBehavior === "auto_search") {
      rules.push(`🔍 Auto-search jobs ${settings.autoSearchFrequency}`);
    } else {
      rules.push("🔍 Ask before searching jobs");
    }

    if (settings.backgroundMode) {
      rules.push("🌙 Can work in background");
    } else {
      rules.push("🌙 Only works when you're active");
    }

    if (settings.autoFollowUpRules.enabled) {
      rules.push("💬 Auto-follow up enabled");
    }

    if (settings.disableDuringHours?.enabled) {
      rules.push(
        `⏰ Disabled ${settings.disableDuringHours.startTime}-${settings.disableDuringHours.endTime}`
      );
    }

    return rules.join("\n");
  }
}

export default AutonomySettingsManager;

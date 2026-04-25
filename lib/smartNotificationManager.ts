import { AssistantDecision, InterruptionLevel } from "./assistantBrain";
import UserMemoryProfileManager from "./userMemoryProfile";

export interface Notification {
  id: string;
  userId: string;
  type: "info" | "success" | "warning" | "action_required";
  title: string;
  message: string;
  action?: {
    label: string;
    callback: () => void;
  };
  timestamp: Date;
  interruptionLevel: InterruptionLevel;
  autoHideAfter?: number; // milliseconds
  read: boolean;
}

export class SmartNotificationManager {
  private static notifications: Map<string, Notification[]> = new Map();
  private static notificationCallbacks: Map<string, Set<(n: Notification) => void>> = new Map();

  /**
   * Generate notification from assistant decision
   */
  static async createNotificationFromDecision(
    userId: string,
    decision: AssistantDecision
  ): Promise<Notification | null> {
    try {
      const memory = await UserMemoryProfileManager.createOrGetProfile(userId);
      const preferences = memory.preferredNotificationStyle;

      // Filter based on user preferences and decision
      if (!this.shouldNotify(decision, preferences)) {
        return null;
      }

      let type: Notification["type"] = "info";
      let title = "";
      let message = decision.action.message || "";
      let autoHide = true;

      // Determine notification type and urgency
      if (decision.action.requiresApproval) {
        type = "action_required";
        title = `Action needed: ${decision.decision}`;
        autoHide = false;
      } else if (decision.action.shouldExecute) {
        type = "success";
        title = `Task executing: ${decision.decision}`;
      } else if (decision.action.timing === "hold") {
        type = "warning";
        title = `Task held: ${decision.decision}`;
      } else {
        type = "info";
        title = `Scheduled: ${decision.decision}`;
      }

      const notification: Notification = {
        id: `notif_${Date.now()}`,
        userId,
        type,
        title,
        message,
        timestamp: new Date(),
        interruptionLevel: decision.action.interruptionLevel,
        autoHideAfter: autoHide ? this.getAutoHideDuration(decision.action.interruptionLevel) : undefined,
        read: false,
      };

      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  }

  /**
   * Send notification and notify subscribers
   */
  static async sendNotification(notification: Notification): Promise<void> {
    if (!this.notifications.has(notification.userId)) {
      this.notifications.set(notification.userId, []);
    }

    this.notifications.get(notification.userId)!.push(notification);

    // Notify all subscribers
    const callbacks = this.notificationCallbacks.get(notification.userId);
    if (callbacks) {
      callbacks.forEach((cb) => cb(notification));
    }

    // Auto-hide if configured
    if (notification.autoHideAfter) {
      setTimeout(() => {
        this.markAsRead(notification.userId, notification.id);
      }, notification.autoHideAfter);
    }
  }

  /**
   * Subscribe to notifications for a user
   */
  static subscribe(
    userId: string,
    callback: (notification: Notification) => void
  ): () => void {
    if (!this.notificationCallbacks.has(userId)) {
      this.notificationCallbacks.set(userId, new Set());
    }

    this.notificationCallbacks.get(userId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.notificationCallbacks.get(userId)?.delete(callback);
    };
  }

  /**
   * Get unread notifications
   */
  static getUnreadNotifications(userId: string): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    return notifications.filter((n) => !n.read);
  }

  /**
   * Get all notifications for user
   */
  static getNotifications(userId: string, limit: number = 20): Notification[] {
    const notifications = this.notifications.get(userId) || [];
    return notifications.slice(-limit);
  }

  /**
   * Mark notification as read
   */
  static markAsRead(userId: string, notificationId: string): void {
    const notifications = this.notifications.get(userId);
    if (notifications) {
      const notification = notifications.find((n) => n.id === notificationId);
      if (notification) {
        notification.read = true;
      }
    }
  }

  /**
   * Decide if notification should be shown
   */
  private static shouldNotify(
    decision: AssistantDecision,
    userPreference: string
  ): boolean {
    const level = decision.action.interruptionLevel;

    switch (userPreference) {
      case "silent":
        // Only notify for action required
        return decision.action.requiresApproval;

      case "subtle":
        // Notify for action required and high urgency
        return decision.action.requiresApproval || decision.action.interruptionLevel === "urgent";

      case "noticeable":
        // Notify for most things except low-priority silent tasks
        return level !== "silent";

      case "prominent":
        // Always notify
        return true;

      default:
        return level !== "silent";
    }
  }

  /**
   * Determine how long to show notification
   */
  private static getAutoHideDuration(level: InterruptionLevel): number {
    switch (level) {
      case "silent":
        return 3000; // 3 seconds
      case "subtle":
        return 5000; // 5 seconds
      case "noticeable":
        return 8000; // 8 seconds
      case "urgent":
        return 0; // Don't auto-hide
      default:
        return 5000;
    }
  }

  /**
   * Format notification for display
   */
  static formatNotificationMessage(decision: AssistantDecision): {
    title: string;
    subtitle?: string;
    emoji?: string;
  } {
    const taskType = decision.decision.split(":")[0].trim();
    const emoji = this.getEmojiForTaskType(taskType);

    return {
      emoji,
      title: `${emoji} ${decision.action.message || decision.decision}`,
      subtitle: `Confidence: ${decision.confidence}%`,
    };
  }

  private static getEmojiForTaskType(taskType: string): string {
    if (taskType.includes("email")) return "📧";
    if (taskType.includes("quote") || taskType.includes("Generate")) return "📝";
    if (taskType.includes("job") || taskType.includes("find")) return "🔍";
    if (taskType.includes("material")) return "📋";
    if (taskType.includes("follow")) return "💬";
    if (taskType.includes("Execute")) return "⚙️";
    return "✨";
  }

  /**
   * Create a summary notification for batched tasks
   */
  static createBatchNotification(
    userId: string,
    tasks: string[],
    totalTime: number
  ): Notification {
    return {
      id: `batch_notif_${Date.now()}`,
      userId,
      type: "info",
      title: `Batch processing ${tasks.length} tasks`,
      message: `I'm batching ${tasks.length} tasks together. Estimated time: ${totalTime} minutes. More efficient this way.`,
      timestamp: new Date(),
      interruptionLevel: "subtle",
      autoHideAfter: 6000,
      read: false,
    };
  }

  /**
   * Create an action-required notification
   */
  static createActionRequiredNotification(
    userId: string,
    action: {
      title: string;
      message: string;
      options: Array<{ label: string; value: string }>;
    }
  ): Notification {
    return {
      id: `action_${Date.now()}`,
      userId,
      type: "action_required",
      title: action.title,
      message: action.message,
      timestamp: new Date(),
      interruptionLevel: "noticeable",
      read: false,
    };
  }

  /**
   * Create a contextual tip notification
   */
  static createContextualTipNotification(
    userId: string,
    tip: string
  ): Notification {
    return {
      id: `tip_${Date.now()}`,
      userId,
      type: "info",
      title: "💡 Tip",
      message: tip,
      timestamp: new Date(),
      interruptionLevel: "subtle",
      autoHideAfter: 10000,
      read: false,
    };
  }

  /**
   * Clear notifications (admin only)
   */
  static clearNotifications(userId: string): void {
    this.notifications.delete(userId);
  }
}

export default SmartNotificationManager;

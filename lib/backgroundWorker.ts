import { TaskQueue, Task, TaskStatus } from "./taskQueue";
import { ConversationManager } from "./conversationManager";
import { ContextRetrieval } from "./contextRetrieval";
import PresenceManager from "./presenceManager";

export interface TaskHandler {
  execute(task: Task): Promise<Record<string, unknown>>;
}

export class EmailTaskHandler implements TaskHandler {
  async execute(task: Task): Promise<Record<string, unknown>> {
    // Placeholder for email operations
    console.log("Executing email task:", task);
    return {
      status: "email_task_executed",
      emailsChecked: 0,
      newEmails: [],
    };
  }
}

export class JobFinderTaskHandler implements TaskHandler {
  async execute(task: Task): Promise<Record<string, unknown>> {
    // Placeholder for job finding
    console.log("Executing job finder task:", task);
    return {
      status: "job_finder_executed",
      jobsFound: 0,
      leads: [],
    };
  }
}

export class QuoteGenerationTaskHandler implements TaskHandler {
  async execute(task: Task): Promise<Record<string, unknown>> {
    // Placeholder for quote generation
    console.log("Executing quote generation task:", task);
    return {
      status: "quote_generated",
      quoteId: "",
      totalAmount: 0,
    };
  }
}

export class MaterialListTaskHandler implements TaskHandler {
  async execute(task: Task): Promise<Record<string, unknown>> {
    // Placeholder for material list generation
    console.log("Executing material list task:", task);
    return {
      status: "material_list_generated",
      materials: [],
      totalCost: 0,
    };
  }
}

export class FollowUpTaskHandler implements TaskHandler {
  async execute(task: Task): Promise<Record<string, unknown>> {
    // Placeholder for follow-up tasks
    console.log("Executing follow-up task:", task);
    return {
      status: "follow_up_executed",
      contacted: false,
    };
  }
}

export class BackgroundWorkerService {
  private static workers: Map<string, NodeJS.Timeout> = new Map();
  private static isRunning: Map<string, boolean> = new Map();
  private static readonly CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds
  private static readonly MAX_CONCURRENT_TASKS = 3;
  private static currentlyProcessing: Map<string, number> = new Map();

  private static handlers: Map<string, TaskHandler> = new Map([
    ["check_emails", new EmailTaskHandler()],
    ["find_jobs", new JobFinderTaskHandler()],
    ["generate_quote", new QuoteGenerationTaskHandler()],
    ["create_material_list", new MaterialListTaskHandler()],
    ["follow_up", new FollowUpTaskHandler()],
  ]);

  /**
   * Start the background worker
   */
  static start(userId: string): void {
    if (this.isRunning.get(userId)) {
      console.log("Background worker already running for user:", userId);
      return;
    }

    this.isRunning.set(userId, true);
    this.currentlyProcessing.set(userId, 0);
    console.log("Background worker started for user:", userId);

    const worker = setInterval(async () => {
      await this.processTasks(userId);
    }, this.CHECK_INTERVAL);
    
    this.workers.set(userId, worker);
  }

  /**
   * Stop the background worker for a specific user
   */
  static stop(userId?: string): void {
    if (userId) {
      const worker = this.workers.get(userId);
      if (worker) {
        clearInterval(worker);
        this.workers.delete(userId);
      }
      this.isRunning.set(userId, false);
      this.currentlyProcessing.delete(userId);
      console.log("Background worker stopped for user:", userId);
    } else {
      this.workers.forEach((worker) => clearInterval(worker));
      this.workers.clear();
      this.isRunning.clear();
      this.currentlyProcessing.clear();
      console.log("All background workers stopped");
    }
  }

  /**
   * Process pending tasks
   */
  private static async processTasks(userId: string): Promise<void> {
    const processing = this.currentlyProcessing.get(userId) || 0;
    if (processing >= this.MAX_CONCURRENT_TASKS) {
      return; // Skip if too many tasks are already processing
    }

    try {
      const pendingTasks = await TaskQueue.getPendingTasks(userId);

      for (const task of pendingTasks) {
        if (this.currentlyProcessing >= this.MAX_CONCURRENT_TASKS) {
          break; // Stop processing if we hit max concurrent
        }

        // Check if this is a scheduled task and if it's time to run it
        if (task.metadata?.scheduledFor) {
          const scheduledTime = new Date(task.metadata.scheduledFor as string).getTime();
          if (scheduledTime > Date.now()) {
            continue; // Not time yet
          }
        }

        await this.executeTask(task);
      }

      // Check for failed tasks that need retrying
      await this.processRetries(userId);
    } catch (error) {
      console.error("Error processing tasks:", error);
    }
  }

  /**
   * Execute a single task
   */
  private static async executeTask(task: Task): Promise<void> {
    if (!task.id) return;

    try {
      this.currentlyProcessing++;
      await TaskQueue.updateTaskStatus(task.id, "in_progress");

      const handler = this.handlers.get(task.type);
      if (!handler) {
        throw new Error(`No handler found for task type: ${task.type}`);
      }

      const result = await handler.execute(task);
      await TaskQueue.updateTaskStatus(task.id, "completed", result);

      console.log(`Task ${task.id} completed successfully`);
    } catch (error) {
      console.error(`Error executing task ${task.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await TaskQueue.updateTaskStatus(task.id, "failed", undefined, errorMessage);

      // Try to retry the task
      const retried = await TaskQueue.retryTask(task.id);
      if (!retried) {
        console.log(`Task ${task.id} exceeded max retries`);
      }
    } finally {
      this.currentlyProcessing--;
    }
  }

  /**
   * Process retries for failed tasks
   */
  private static async processRetries(userId: string): Promise<void> {
    try {
      // Get user's tasks and check for retryable ones
      // This would need a method in TaskQueue to get tasks ready for retry
      console.log("Checking for tasks ready to retry...");
    } catch (error) {
      console.error("Error processing retries:", error);
    }
  }

  /**
   * Schedule a task for later
   */
  static async scheduleTask(
    userId: string,
    type: string,
    priority: string,
    title: string,
    payload?: Record<string, unknown>,
    scheduleTime?: Date
  ): Promise<string> {
    const metadata = scheduleTime ? { scheduledFor: scheduleTime.toISOString() } : undefined;

    return TaskQueue.addTask(
      userId,
      type as any,
      priority as any,
      title,
      payload,
      metadata
    );
  }

  /**
   * Get worker status
   */
  static getStatus(): {
    isRunning: boolean;
    currentlyProcessing: number;
    maxConcurrent: number;
  } {
    return {
      isRunning: this.isRunning,
      currentlyProcessing: this.currentlyProcessing,
      maxConcurrent: this.MAX_CONCURRENT_TASKS,
    };
  }

  /**
   * Register custom task handler
   */
  static registerHandler(taskType: string, handler: TaskHandler): void {
    this.handlers.set(taskType, handler);
  }

  /**
   * Get intelligent task recommendations based on user activity
   */
  static async getProactiveRecommendations(userId: string): Promise<Array<{
    taskType: string;
    reason: string;
    urgency: "low" | "medium" | "high";
  }>> {
    const recommendations: Array<{
      taskType: string;
      reason: string;
      urgency: "low" | "medium" | "high";
    }> = [];

    try {
      // Check user presence
      const presence = await PresenceManager.getPresence(userId);

      if (presence?.currentActivity === "idle" && presence?.idleTime && presence.idleTime > 300) {
        // User is idle, good time for background tasks
        recommendations.push({
          taskType: "check_emails",
          reason: "You've been idle for a while. Let me check your emails.",
          urgency: "medium",
        });

        recommendations.push({
          taskType: "find_jobs",
          reason: "Time to search for new job leads in your area.",
          urgency: "medium",
        });

        recommendations.push({
          taskType: "analyze_leads",
          reason: "Let me analyze and score your recent leads.",
          urgency: "low",
        });
      }

      // Get recent conversations to infer needs
      const recentConversations = await ConversationManager.getRecentConversations(userId, 3);

      if (recentConversations.length > 0) {
        const allTopics = recentConversations.flatMap((c) =>
          c.messages.flatMap((m) => m.metadata?.topics || [])
        );

        if (allTopics.includes("quote")) {
          recommendations.push({
            taskType: "generate_quote",
            reason: "I noticed you were discussing quotes. Shall I prepare a draft?",
            urgency: "medium",
          });
        }

        if (allTopics.includes("material")) {
          recommendations.push({
            taskType: "create_material_list",
            reason: "Based on our recent discussion, let me create a material list.",
            urgency: "medium",
          });
        }
      }

      // Remove duplicates
      const seen = new Set<string>();
      return recommendations.filter((rec) => {
        if (seen.has(rec.taskType)) return false;
        seen.add(rec.taskType);
        return true;
      });
    } catch (error) {
      console.error("Error getting proactive recommendations:", error);
      return [];
    }
  }

  /**
   * Create a smart task plan based on user state
   */
  static async createSmartTaskPlan(userId: string): Promise<Array<{
    order: number;
    task: {
      type: string;
      title: string;
      priority: "low" | "medium" | "high";
    };
    reason: string;
  }>> {
    const plan: Array<{
      order: number;
      task: { type: string; title: string; priority: "low" | "medium" | "high" };
      reason: string;
    }> = [];

    try {
      const presence = await PresenceManager.getPresence(userId);
      const recommendations = await this.getProactiveRecommendations(userId);

      // If user is active, prioritize communication tasks
      if (presence?.isOnline && presence?.currentActivity === "active") {
        plan.push({
          order: 1,
          task: {
            type: "check_emails",
            title: "Check for new emails",
            priority: "high",
          },
          reason: "You're online - check for urgent client messages",
        });

        plan.push({
          order: 2,
          task: {
            type: "follow_up",
            title: "Follow up on pending quotes",
            priority: "medium",
          },
          reason: "Check on any pending client responses",
        });
      } else if (presence?.currentActivity === "idle") {
        // If idle, do deeper analysis and research
        recommendations.forEach((rec, index) => {
          plan.push({
            order: index + 1,
            task: {
              type: rec.taskType,
              title: rec.reason,
              priority: rec.urgency,
            },
            reason: rec.reason,
          });
        });
      }

      return plan.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error("Error creating smart task plan:", error);
      return [];
    }
  }
}

export default BackgroundWorkerService;

import { Task } from "./taskQueue";
import { Conversation } from "./conversationManager";

export type TaskCategory =
  | "communication"
  | "planning"
  | "research"
  | "customer_engagement"
  | "financial"
  | "maintenance"
  | "other";

export type InterruptionLevel = "silent" | "subtle" | "noticeable" | "urgent";

export interface ClassifiedTask {
  taskId: string;
  originalType: string;
  category: TaskCategory;
  urgency: number; // 0-100
  interruptionLevel: InterruptionLevel;
  requiresApproval: boolean;
  requiresUserContext: boolean;
  estimatedDuration: number; // minutes
  dependencies: string[]; // other task IDs this depends on
  canBeGrouped: boolean;
  groupWith?: string[]; // similar task IDs to batch together
  reasonsForClassification: string[];
}

export class TaskClassifier {
  private static readonly TASK_DEFINITIONS: Record<string, any> = {
    check_emails: {
      category: "communication",
      baseDuration: 15,
      canBeGrouped: true,
      requiresApproval: false,
    },
    find_jobs: {
      category: "research",
      baseDuration: 30,
      canBeGrouped: false,
      requiresApproval: false,
    },
    generate_quote: {
      category: "financial",
      baseDuration: 45,
      canBeGrouped: false,
      requiresApproval: true,
    },
    create_material_list: {
      category: "planning",
      baseDuration: 20,
      canBeGrouped: false,
      requiresApproval: true,
    },
    send_email: {
      category: "communication",
      baseDuration: 5,
      canBeGrouped: true,
      requiresApproval: true,
    },
    follow_up: {
      category: "customer_engagement",
      baseDuration: 10,
      canBeGrouped: true,
      requiresApproval: false,
    },
    analyze_leads: {
      category: "research",
      baseDuration: 25,
      canBeGrouped: false,
      requiresApproval: false,
    },
  };

  /**
   * Classify a task to understand its nature and priority
   */
  static classifyTask(
    task: Task,
    context: {
      isWorkingHours: boolean;
      isUserIdle: boolean;
      pendingHighPriorityTasks: number;
      recentSimilarTasks: Task[];
      userPriorities: string[];
    }
  ): ClassifiedTask {
    const definition = this.TASK_DEFINITIONS[task.type] || {
      category: "other",
      baseDuration: 30,
      canBeGrouped: false,
      requiresApproval: false,
    };

    const reasons: string[] = [];
    let urgency = this.calculateBaseUrgency(task.priority);
    let interruptionLevel: InterruptionLevel = "subtle";

    // Adjust urgency based on context
    if (task.priority === "urgent") {
      reasons.push("Task marked as urgent");
      urgency = 100;
      interruptionLevel = "urgent";
    } else if (task.priority === "high") {
      urgency += 30;
      if (context.isUserIdle) {
        interruptionLevel = "noticeable";
        reasons.push("High priority and user is idle");
      } else {
        interruptionLevel = "subtle";
        reasons.push("High priority but user is active");
      }
    }

    // Financial tasks get higher urgency
    if (definition.category === "financial") {
      urgency += 20;
      reasons.push("Financial task - higher priority");
    }

    // Customer engagement during working hours gets boost
    if (
      definition.category === "customer_engagement" &&
      context.isWorkingHours &&
      context.isUserIdle
    ) {
      urgency += 15;
      reasons.push("Customer engagement during working hours");
    }

    // Research tasks lower priority if many high-priority tasks pending
    if (
      definition.category === "research" &&
      context.pendingHighPriorityTasks > 3
    ) {
      urgency -= 20;
      reasons.push("Multiple high-priority tasks pending - deprioritizing research");
    }

    // Cap urgency
    urgency = Math.min(100, Math.max(0, urgency));

    // Determine grouping
    const groupWith = context.recentSimilarTasks
      .filter((t) => t.type === task.type && t.status === "pending")
      .map((t) => t.id || "")
      .filter((id) => id);

    const requiresUserContext =
      definition.category === "financial" ||
      definition.category === "customer_engagement";

    return {
      taskId: task.id || "",
      originalType: task.type,
      category: definition.category,
      urgency,
      interruptionLevel,
      requiresApproval: definition.requiresApproval,
      requiresUserContext,
      estimatedDuration: definition.baseDuration,
      dependencies: this.identifyDependencies(task),
      canBeGrouped: definition.canBeGrouped,
      groupWith: groupWith.length > 0 ? groupWith : undefined,
      reasonsForClassification: reasons,
    };
  }

  /**
   * Classify multiple tasks and determine optimal execution order
   */
  static classifyAndPrioritize(
    tasks: Task[],
    context: {
      isWorkingHours: boolean;
      isUserIdle: boolean;
      userPriorities: string[];
      totalTimeAvailable: number; // minutes
    }
  ): ClassifiedTask[] {
    const classified = tasks.map((task) =>
      this.classifyTask(task, {
        isWorkingHours: context.isWorkingHours,
        isUserIdle: context.isUserIdle,
        pendingHighPriorityTasks: tasks.filter((t) => t.priority === "high").length,
        recentSimilarTasks: tasks.filter((t) => t.type === task.type),
        userPriorities: context.userPriorities,
      })
    );

    // Sort by urgency
    return classified.sort((a, b) => b.urgency - a.urgency);
  }

  /**
   * Identify if this task has dependencies on other tasks
   */
  private static identifyDependencies(task: Task): string[] {
    const dependencies: string[] = [];

    // Quote generation needs customer context
    if (
      task.type === "generate_quote" &&
      task.payload?.customerId
    ) {
      dependencies.push(`get_customer_context_${task.payload.customerId}`);
    }

    // Material list needs quote first
    if (
      task.type === "create_material_list" &&
      task.payload?.quoteId
    ) {
      dependencies.push(`quote_${task.payload.quoteId}`);
    }

    return dependencies;
  }

  /**
   * Analyze conversation to determine if task classification is needed
   */
  static analyzeConversationForTasks(
    conversation: Conversation
  ): Array<{ suggestedTaskType: string; confidence: number; reason: string }> {
    const suggestions: Array<{
      suggestedTaskType: string;
      confidence: number;
      reason: string;
    }> = [];

    const text = conversation.messages
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();

    // Check for keywords that suggest task types
    const taskKeywords: Record<string, { type: string; keywords: string[] }> = {
      check_emails: {
        type: "check_emails",
        keywords: ["email", "message", "inbox", "check email"],
      },
      find_jobs: {
        type: "find_jobs",
        keywords: ["job", "lead", "opportunity", "work", "project"],
      },
      generate_quote: {
        type: "generate_quote",
        keywords: ["quote", "estimate", "bid", "price", "cost"],
      },
      create_material_list: {
        type: "create_material_list",
        keywords: ["material", "supplies", "wood", "paint", "items needed"],
      },
      follow_up: {
        type: "follow_up",
        keywords: ["follow up", "reach out", "contact", "touch base"],
      },
    };

    Object.entries(taskKeywords).forEach(([, config]) => {
      const matchCount = config.keywords.filter((keyword) =>
        text.includes(keyword)
      ).length;

      if (matchCount > 0) {
        const confidence = Math.min(100, matchCount * 20);
        suggestions.push({
          suggestedTaskType: config.type,
          confidence,
          reason: `Found ${matchCount} relevant keyword(s)`,
        });
      }
    });

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate base urgency from priority level
   */
  private static calculateBaseUrgency(priority: string): number {
    switch (priority) {
      case "urgent":
        return 100;
      case "high":
        return 75;
      case "medium":
        return 50;
      case "low":
        return 25;
      default:
        return 50;
    }
  }

  /**
   * Check if two tasks can be grouped/batched together
   */
  static canGroupTasks(task1: ClassifiedTask, task2: ClassifiedTask): boolean {
    return (
      task1.category === task2.category &&
      task1.canBeGrouped &&
      task2.canBeGrouped &&
      Math.abs(task1.urgency - task2.urgency) < 30
    );
  }

  /**
   * Estimate total execution time for a batch of tasks
   */
  static estimateExecutionTime(tasks: ClassifiedTask[]): number {
    if (tasks.length === 0) return 0;

    const baseTime = tasks.reduce((sum, t) => sum + t.estimatedDuration, 0);

    // If tasks can be grouped, reduce time
    const groupable = tasks.filter((t) => t.canBeGrouped);
    if (groupable.length > 1) {
      const groupSavings = groupable.length * 3; // 3 min saved per grouped task
      return Math.max(baseTime - groupSavings, Math.floor(baseTime * 0.7));
    }

    return baseTime;
  }

  /**
   * Check if any task is related to user priority
   */
  static checkPriorityAlignment(
    task: ClassifiedTask,
    userPriorities: string[]
  ): boolean {
    return userPriorities.some((priority) =>
      task.reasonsForClassification.some((reason) =>
        reason.toLowerCase().includes(priority.toLowerCase())
      )
    );
  }
}

export default TaskClassifier;

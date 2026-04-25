import { Task, TaskStatus } from "./taskQueue";
import UserMemoryProfileManager, { UserMemoryProfile } from "./userMemoryProfile";
import { TaskClassifier, ClassifiedTask, InterruptionLevel } from "./taskClassifier";
import PresenceManager, { UserPresence } from "./presenceManager";
import { ConversationManager, Conversation } from "./conversationManager";

export interface AssistantDecision {
  id: string;
  timestamp: Date;
  decision: string; // The action to take
  reasoning: {
    userState: string;
    taskContext: string;
    historicalPattern?: string;
  };
  action: {
    shouldExecute: boolean;
    requiresApproval: boolean;
    interruptionLevel: InterruptionLevel;
    timing: "immediate" | "soon" | "batch" | "later" | "hold";
    message?: string; // What to tell the user
  };
  confidence: number; // 0-100
}

export interface AssistantState {
  presence: UserPresence | null;
  memory: UserMemoryProfile;
  pendingDecisions: AssistantDecision[];
  isThinkingAbout: string | null;
}

export class AssistantBrain {
  private static readonly MIN_CONFIDENCE_TO_EXECUTE = 60;
  private static readonly MAX_BATCH_WAIT_TIME = 300000; // 5 minutes

  /**
   * Main decision engine - processes a task and decides what to do
   */
  static async makeDecision(
    userId: string,
    task: Task,
    context: {
      presence: UserPresence | null;
      pendingTasks: Task[];
      recentConversations: Conversation[];
      currentTime: Date;
    }
  ): Promise<AssistantDecision> {
    try {
      // Get user memory profile
      const memory = await UserMemoryProfileManager.createOrGetProfile(userId);

      // Classify the task
      const isWorkingHours = await UserMemoryProfileManager.isWorkingHours(userId);
      const isUserIdle = context.presence?.currentActivity === "idle";

      const classified = TaskClassifier.classifyTask(task, {
        isWorkingHours,
        isUserIdle,
        pendingHighPriorityTasks: context.pendingTasks.filter((t) => t.priority === "high").length,
        recentSimilarTasks: context.pendingTasks.filter((t) => t.type === task.type),
        userPriorities: memory.currentPriorities.map((p) => p.priority),
      });

      // Generate decision
      const decision = this.generateDecision(
        task,
        classified,
        memory,
        context,
        isWorkingHours,
        isUserIdle
      );

      return decision;
    } catch (error) {
      console.error("Error making decision:", error);
      throw error;
    }
  }

  /**
   * Create an execution plan for multiple tasks
   */
  static async createExecutionPlan(
    userId: string,
    tasks: Task[],
    context: {
      presence: UserPresence | null;
      timeAvailable: number; // minutes
      currentTime: Date;
    }
  ): Promise<{
    plan: Array<{ taskId: string; order: number; timing: string; reason: string }>;
    totalEstimatedTime: number;
    recommendations: string[];
  }> {
    try {
      const memory = await UserMemoryProfileManager.createOrGetProfile(userId);
      const isWorkingHours = await UserMemoryProfileManager.isWorkingHours(userId);
      const isUserIdle = context.presence?.currentActivity === "idle";

      // Classify all tasks
      const classified = TaskClassifier.classifyAndPrioritize(tasks, {
        isWorkingHours,
        isUserIdle,
        userPriorities: memory.currentPriorities.map((p) => p.priority),
        totalTimeAvailable: context.timeAvailable,
      });

      // Group tasks where possible
      const grouped = this.groupTasks(classified);

      // Create execution plan
      const plan: Array<{ taskId: string; order: number; timing: string; reason: string }> = [];
      let totalTime = 0;

      grouped.forEach((group, index) => {
        const isGrouped = Array.isArray(group);
        const items = isGrouped ? group : [group];
        const estimatedTime = TaskClassifier.estimateExecutionTime(items);
        totalTime += estimatedTime;

        const canFit = totalTime <= context.timeAvailable;

        items.forEach((item: ClassifiedTask) => {
          let timing = "later";
          let reason = "";

          if (canFit && item.urgency > 60) {
            timing = "immediate";
            reason = `High urgency (${item.urgency}/100) and time available`;
          } else if (canFit && item.urgency > 40) {
            timing = "soon";
            reason = `Medium urgency and time available`;
          } else if (!canFit) {
            timing = "batch";
            reason = `Batch with similar tasks to save time`;
          } else {
            timing = "later";
            reason = `Lower priority, schedule for later`;
          }

          plan.push({
            taskId: item.taskId,
            order: index + 1,
            timing,
            reason,
          });
        });
      });

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        classified,
        memory,
        isUserIdle,
        totalTime,
        context.timeAvailable
      );

      return {
        plan: plan.sort((a, b) => a.order - b.order),
        totalEstimatedTime: totalTime,
        recommendations,
      };
    } catch (error) {
      console.error("Error creating execution plan:", error);
      throw error;
    }
  }

  /**
   * Generate human-readable decision with reasoning
   */
  private static generateDecision(
    task: Task,
    classified: ClassifiedTask,
    memory: UserMemoryProfile,
    context: {
      presence: UserPresence | null;
      pendingTasks: Task[];
      recentConversations: Conversation[];
      currentTime: Date;
    },
    isWorkingHours: boolean,
    isUserIdle: boolean
  ): AssistantDecision {
    const reasoning: AssistantDecision["reasoning"] = {
      userState: `${context.presence?.isOnline ? "Online" : "Offline"}, ${context.presence?.currentActivity || "idle"}`,
      taskContext: `${classified.category} task, urgency: ${classified.urgency}/100`,
    };

    let shouldExecute = classified.urgency >= this.MIN_CONFIDENCE_TO_EXECUTE;
    let timing: AssistantDecision["action"]["timing"] = "immediate";
    let message = "";

    // Decision logic
    if (classified.requiresApproval && !this.userIsActive(context)) {
      shouldExecute = false;
      timing = "hold";
      message = `This requires your approval. I'll wait for your input.`;
      reasoning.historicalPattern = "Task requires user decision";
    } else if (classified.requiresApproval && this.userIsActive(context)) {
      shouldExecute = true;
      timing = "immediate";
      message = `This task needs your approval first. Ready when you are.`;
    } else if (!isWorkingHours && classified.category === "customer_engagement") {
      shouldExecute = false;
      timing = "later";
      message = `Outside working hours. I'll handle this during business hours.`;
      reasoning.historicalPattern = "Respects working hours for customer communication";
    } else if (isUserIdle && classified.urgency > 60) {
      shouldExecute = true;
      timing = "immediate";
      message = `You have a moment - let me handle this high-priority task.`;
    } else if (isUserIdle && classified.urgency > 40) {
      shouldExecute = true;
      timing = "soon";
      message = `When you're ready, I can process this.`;
    } else if (this.userIsActive(context) && classified.category === "research") {
      shouldExecute = false;
      timing = "batch";
      message = `You're busy. I'll batch this with similar research tasks.`;
    } else {
      shouldExecute = true;
      timing = this.decideTiming(classified, context);
    }

    const confidence = Math.min(100, classified.urgency + (shouldExecute ? 20 : -10));

    return {
      id: `decision_${task.id}_${Date.now()}`,
      timestamp: new Date(),
      decision: `${shouldExecute ? "Execute" : "Hold"} ${task.type}: ${task.title}`,
      reasoning,
      action: {
        shouldExecute: shouldExecute && confidence >= this.MIN_CONFIDENCE_TO_EXECUTE,
        requiresApproval: classified.requiresApproval,
        interruptionLevel: this.decideInterruption(classified, context),
        timing,
        message,
      },
      confidence,
    };
  }

  /**
   * Decide whether to interrupt user and how urgently
   */
  private static decideInterruption(
    classified: ClassifiedTask,
    context: {
      presence: UserPresence | null;
      pendingTasks: Task[];
    }
  ): InterruptionLevel {
    const userIsActive = context.presence?.currentActivity === "active";
    const hasMultiplePending = context.pendingTasks.length > 5;

    if (classified.urgency > 85) return "urgent";
    if (classified.urgency > 70 && !userIsActive) return "noticeable";
    if (classified.urgency > 60 && !hasMultiplePending) return "subtle";
    return "silent";
  }

  /**
   * Decide when to execute
   */
  private static decideTiming(
    classified: ClassifiedTask,
    context: { currentTime: Date }
  ): AssistantDecision["action"]["timing"] {
    if (classified.urgency > 75) return "immediate";
    if (classified.urgency > 50) return "soon";
    if (classified.urgency > 30) return "batch";
    return "later";
  }

  /**
   * Check if user is actively using the app
   */
  private static userIsActive(context: {
    presence: UserPresence | null;
  }): boolean {
    return (
      context.presence?.isOnline === true &&
      context.presence?.currentActivity === "active"
    );
  }

  /**
   * Group similar tasks for batch processing
   */
  private static groupTasks(classified: ClassifiedTask[]): (ClassifiedTask | ClassifiedTask[])[] {
    const grouped: (ClassifiedTask | ClassifiedTask[])[] = [];
    const processed = new Set<string>();

    classified.forEach((task) => {
      if (processed.has(task.taskId)) return;

      if (task.canBeGrouped) {
        // Find similar tasks to group with
        const similar = classified.filter(
          (t) =>
            !processed.has(t.taskId) &&
            TaskClassifier.canGroupTasks(task, t)
        );

        if (similar.length > 1) {
          grouped.push(similar);
          similar.forEach((t) => processed.add(t.taskId));
        } else {
          grouped.push(task);
          processed.add(task.taskId);
        }
      } else {
        grouped.push(task);
        processed.add(task.taskId);
      }
    });

    return grouped;
  }

  /**
   * Generate proactive recommendations
   */
  private static generateRecommendations(
    classified: ClassifiedTask[],
    memory: UserMemoryProfile,
    isUserIdle: boolean,
    totalTime: number,
    timeAvailable: number
  ): string[] {
    const recommendations: string[] = [];

    if (isUserIdle && classified.length > 0) {
      const highUrgency = classified.filter((t) => t.urgency > 70);
      if (highUrgency.length > 0) {
        recommendations.push(
          `You have ${highUrgency.length} high-priority task(s) that could be done now.`
        );
      }
    }

    if (memory.unfinishedConversations.length > 0) {
      recommendations.push(
        `You have ${memory.unfinishedConversations.length} unfinished conversation(s) waiting for follow-up.`
      );
    }

    if (totalTime > timeAvailable) {
      recommendations.push(
        `Total task time (${totalTime}min) exceeds available time. I'll prioritize by urgency.`
      );
    }

    if (
      memory.currentPriorities.length === 0 &&
      classified.some((t) => t.category === "financial")
    ) {
      recommendations.push(`No current priorities set. Financial tasks are pending.`);
    }

    return recommendations;
  }

  /**
   * Learn from user decisions
   */
  static async learnFromUserDecision(
    userId: string,
    decision: AssistantDecision,
    userOverride?: {
      approved: boolean;
      reason: string;
    }
  ): Promise<void> {
    try {
      const memory = await UserMemoryProfileManager.createOrGetProfile(userId);

      if (userOverride && !userOverride.approved && decision.action.shouldExecute) {
        // User rejected our suggestion - learn from it
        if (decision.reasoning.userState.includes("idle")) {
          // User rejected action even though idle - adjust
          memory.preferredNotificationStyle = "subtle";
        }
      }

      // Log the decision outcome
      console.log(`Decision learning: ${decision.decision} - ${userOverride?.reason || "executed"}`);

      await UserMemoryProfileManager.updateProfile(userId, memory);
    } catch (error) {
      console.error("Error learning from decision:", error);
    }
  }
}

export default AssistantBrain;

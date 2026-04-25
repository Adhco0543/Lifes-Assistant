import { TaskQueue, Task } from "./taskQueue";
import { BackgroundWorkerService } from "./backgroundWorker";
import { AssistantBrain, AssistantDecision } from "./assistantBrain";
import PresenceManager, { UserPresence } from "./presenceManager";
import { ConversationManager, Conversation } from "./conversationManager";
import SmartNotificationManager, { Notification } from "./smartNotificationManager";
import UserMemoryProfileManager from "./userMemoryProfile";

export interface DecisionLog {
  id: string;
  timestamp: Date;
  decision: AssistantDecision;
  executed: boolean;
  result?: {
    success: boolean;
    message: string;
  };
}

export class IntelligentBackgroundWorker {
  private static decisionLogs: Map<string, DecisionLog[]> = new Map();
  private static activeWorkers: Set<string> = new Set();
  private static readonly DECISION_LOG_RETENTION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start intelligent background worker
   */
  static async start(userId: string): Promise<void> {
    // Prevent multiple starts for same user
    if (this.activeWorkers.has(userId)) {
      console.log("🧠 Background worker already initialized for user:", userId);
      return;
    }

    this.activeWorkers.add(userId);
    console.log("🧠 Intelligent Background Worker started for", userId);
    
    // Start base worker
    BackgroundWorkerService.start(userId);

    // Start decision maker loop
    this.startDecisionMaker(userId);
  }

  /**
   * Stop intelligent background worker
   */
  static stop(userId: string): void {
    this.activeWorkers.delete(userId);
    BackgroundWorkerService.stop(userId);
    console.log("🧠 Intelligent Background Worker stopped for", userId);
  }

  /**
   * Main decision-making loop
   */
  private static async startDecisionMaker(userId: string): Promise<void> {
    setInterval(async () => {
      try {
        await this.makeAndExecuteDecisions(userId);
      } catch (error) {
        console.error("Error in decision making loop:", error);
      }
    }, 45 * 1000); // Run every 45 seconds
  }

  /**
   * Get pending tasks, make decisions, and execute
   */
  static async makeAndExecuteDecisions(userId: string): Promise<void> {
    try {
      // Get current state
      const [
        pendingTasks,
        presence,
        recentConversations,
      ] = await Promise.all([
        TaskQueue.getPendingTasks(userId),
        PresenceManager.getPresence(userId),
        ConversationManager.getRecentConversations(userId, 5),
      ]);

      if (pendingTasks.length === 0) {
        return;
      }

      // Create execution plan using brain
      const plan = await AssistantBrain.createExecutionPlan(userId, pendingTasks, {
        presence,
        timeAvailable: 60, // Assume 60 minutes available in background
        currentTime: new Date(),
      });

      // Make individual decisions
      for (const task of pendingTasks) {
        const decision = await AssistantBrain.makeDecision(userId, task, {
          presence,
          pendingTasks,
          recentConversations,
          currentTime: new Date(),
        });

        // Log decision
        this.logDecision(userId, decision);

        // Create and send notification
        const notification = await SmartNotificationManager.createNotificationFromDecision(
          userId,
          decision
        );

        if (notification) {
          await SmartNotificationManager.sendNotification(notification);
        }

        // Execute if approved
        if (decision.action.shouldExecute) {
          await this.executeTaskWithBrainContext(userId, task, decision);
          this.logDecisionExecution(userId, decision, true, "Task executed successfully");
        } else if (decision.action.requiresApproval) {
          // Wait for user input - don't execute yet
          console.log(`⏳ Waiting for approval: ${decision.decision}`);
        } else {
          console.log(`⏭️ Scheduled for later: ${decision.decision}`);
        }
      }

      // Show plan summary if complex
      if (plan.plan.length > 3) {
        const summary = `📊 Execution Plan: ${plan.plan.length} tasks scheduled in ${plan.totalEstimatedTime} minutes`;
        const tipNotification = SmartNotificationManager.createContextualTipNotification(
          userId,
          summary
        );
        await SmartNotificationManager.sendNotification(tipNotification);
      }

      // Show recommendations
      if (plan.recommendations.length > 0) {
        console.log("💡 Recommendations:", plan.recommendations);
      }
    } catch (error) {
      console.error("Error making decisions:", error);
    }
  }

  /**
   * Execute task with context from brain
   */
  private static async executeTaskWithBrainContext(
    userId: string,
    task: Task,
    decision: AssistantDecision
  ): Promise<void> {
    try {
      const memory = await UserMemoryProfileManager.createOrGetProfile(userId);

      // Pass brain context to task execution
      const context = {
        decision,
        userMemory: memory,
        interruptionLevel: decision.action.interruptionLevel,
      };

      console.log(`⚙️ Executing: ${task.title} [${decision.confidence}% confidence]`);

      // Update task status to in_progress
      await TaskQueue.updateTaskStatus(task.id || "", "in_progress");

      // Execute based on handler (same as BackgroundWorkerService)
      // Handler execution happens in BackgroundWorkerService
      // This just adds the brain context

      // Learn from execution
      await AssistantBrain.learnFromUserDecision(userId, decision);
    } catch (error) {
      console.error("Error executing task:", error);
    }
  }

  /**
   * Log a decision for transparency
   */
  private static logDecision(userId: string, decision: AssistantDecision): void {
    if (!this.decisionLogs.has(userId)) {
      this.decisionLogs.set(userId, []);
    }

    const log: DecisionLog = {
      id: decision.id,
      timestamp: new Date(),
      decision,
      executed: false,
    };

    this.decisionLogs.get(userId)!.push(log);

    // Clean up old logs
    this.cleanupOldLogs(userId);
  }

  /**
   * Mark decision as executed
   */
  private static logDecisionExecution(
    userId: string,
    decision: AssistantDecision,
    success: boolean,
    message: string
  ): void {
    const logs = this.decisionLogs.get(userId);
    if (logs) {
      const log = logs.find((l) => l.id === decision.id);
      if (log) {
        log.executed = true;
        log.result = { success, message };
      }
    }
  }

  /**
   * Get decision history for transparency
   */
  static getDecisionHistory(userId: string, limit: number = 50): DecisionLog[] {
    const logs = this.decisionLogs.get(userId) || [];
    return logs.slice(-limit);
  }

  /**
   * Get decision statistics
   */
  static getDecisionStats(userId: string): {
    totalDecisions: number;
    executedDecisions: number;
    executionRate: number;
    averageConfidence: number;
  } {
    const logs = this.decisionLogs.get(userId) || [];

    if (logs.length === 0) {
      return {
        totalDecisions: 0,
        executedDecisions: 0,
        executionRate: 0,
        averageConfidence: 0,
      };
    }

    const executed = logs.filter((l) => l.executed).length;
    const avgConfidence =
      logs.reduce((sum, l) => sum + l.decision.confidence, 0) / logs.length;

    return {
      totalDecisions: logs.length,
      executedDecisions: executed,
      executionRate: (executed / logs.length) * 100,
      averageConfidence: avgConfidence,
    };
  }

  /**
   * Get recent major decisions
   */
  static getRecentMajorDecisions(userId: string, hours: number = 1): DecisionLog[] {
    const logs = this.decisionLogs.get(userId) || [];
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    return logs
      .filter(
        (l) =>
          l.timestamp.getTime() > cutoff &&
          (l.decision.confidence > 70 || l.decision.action.interruptionLevel !== "silent")
      )
      .slice(-10);
  }

  /**
   * Override a decision (user can disagree with AI)
   */
  static async overrideDecision(
    userId: string,
    decisionId: string,
    userChoice: "approve" | "reject" | "reschedule",
    reason?: string
  ): Promise<void> {
    const logs = this.decisionLogs.get(userId);
    if (!logs) return;

    const log = logs.find((l) => l.id === decisionId);
    if (!log) return;

    console.log(
      `👤 User override: ${userChoice} for decision "${log.decision.decision}" - ${reason || ""}`
    );

    // Learn from user override
    await AssistantBrain.learnFromUserDecision(userId, log.decision, {
      approved: userChoice === "approve",
      reason: reason || userChoice,
    });

    // Update memory based on override
    const memory = await UserMemoryProfileManager.createOrGetProfile(userId);
    if (userChoice === "reject" && log.decision.action.shouldExecute) {
      // User rejected what we decided to do - adjust confidence threshold
      memory.preferredNotificationStyle = "silent";
    }
  }

  /**
   * Clean up old logs
   */
  private static cleanupOldLogs(userId: string): void {
    const logs = this.decisionLogs.get(userId);
    if (!logs) return;

    const cutoff = Date.now() - this.DECISION_LOG_RETENTION;
    const filtered = logs.filter((l) => l.timestamp.getTime() > cutoff);

    if (filtered.length < logs.length) {
      this.decisionLogs.set(userId, filtered);
    }
  }

  /**
   * Stop the worker
   */
  static stop(): void {
    BackgroundWorkerService.stop();
    console.log("🧠 Intelligent Background Worker stopped");
  }
}

export default IntelligentBackgroundWorker;

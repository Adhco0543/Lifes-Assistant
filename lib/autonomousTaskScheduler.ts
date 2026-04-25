/**
 * autonomousTaskScheduler.ts - Schedule tasks to run automatically
 * Enables recurring tasks, delayed execution, conditional workflows
 */

import { CustomTask, TaskStep } from "./customTaskEngine";
import { workflowExecutor, ExecutionResult } from "./workflowExecutor";
import { db } from "../public/src/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";

export interface ScheduledTask extends CustomTask {
  scheduledTaskId: string;
  schedule: TaskSchedule;
  lastRunAt?: Date;
  nextRunAt: Date;
  isActive: boolean;
  executionHistory: ExecutionRecord[];
  maxRetries: number;
  retryCount: number;
}

export interface TaskSchedule {
  type: "once" | "recurring" | "conditional";
  runsAt?: Date; // For 'once'
  interval?: "daily" | "weekly" | "hourly" | "every_4_hours" | "every_2_hours";
  dayOfWeek?: number; // 0-6 for weekly
  timeOfDay?: string; // HH:mm format
  condition?: string; // For conditional execution
}

export interface ExecutionRecord {
  executedAt: Date;
  success: boolean;
  result?: string;
  error?: string;
  duration: number; // milliseconds
}

class AutonomousTaskSchedulerClass {
  private static instance: AutonomousTaskSchedulerClass;
  private executionTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: Set<string> = new Set();

  private constructor() {}

  static getInstance(): AutonomousTaskSchedulerClass {
    if (!AutonomousTaskSchedulerClass.instance) {
      AutonomousTaskSchedulerClass.instance = new AutonomousTaskSchedulerClass();
    }
    return AutonomousTaskSchedulerClass.instance;
  }

  /**
   * Schedule a task to run automatically
   */
  async scheduleTask(
    userId: string,
    task: CustomTask,
    schedule: TaskSchedule
  ): Promise<ScheduledTask> {
    const scheduledTask: ScheduledTask = {
      ...task,
      scheduledTaskId: `scheduled-${Date.now()}`,
      schedule,
      nextRunAt: this.calculateNextRunTime(schedule),
      isActive: true,
      executionHistory: [],
      maxRetries: 3,
      retryCount: 0,
    };

    // Save to Firestore
    try {
      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const docRef = await addDoc(tasksRef, {
        ...scheduledTask,
        nextRunAt: Timestamp.fromDate(scheduledTask.nextRunAt),
      });

      scheduledTask.id = docRef.id;

      // Start monitoring this task
      this.setupTaskMonitoring(userId, scheduledTask);

      return scheduledTask;
    } catch (error) {
      console.error("Failed to schedule task:", error);
      throw error;
    }
  }

  /**
   * Setup monitoring for a scheduled task
   */
  private setupTaskMonitoring(userId: string, task: ScheduledTask): void {
    const taskKey = `${userId}:${task.scheduledTaskId}`;

    // Clear existing timer
    const existingTimer = this.executionTimers.get(taskKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate delay until next run
    const now = Date.now();
    const delay = Math.max(0, task.nextRunAt.getTime() - now);

    if (delay > 0) {
      const timer = setTimeout(() => {
        this.executeScheduledTask(userId, task);
      }, delay);

      this.executionTimers.set(taskKey, timer);
      console.log(`Task ${task.scheduledTaskId} scheduled for ${new Date(task.nextRunAt).toISOString()}`);
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeScheduledTask(
    userId: string,
    task: ScheduledTask
  ): Promise<void> {
    if (this.isRunning.has(task.scheduledTaskId)) {
      console.log(`Task ${task.scheduledTaskId} already running`);
      return;
    }

    this.isRunning.add(task.scheduledTaskId);
    const startTime = Date.now();

    try {
      console.log(`Executing scheduled task: ${task.description}`);

      // Execute the task
      const result = await workflowExecutor.executeTask(task);

      const duration = Date.now() - startTime;
      const executionRecord: ExecutionRecord = {
        executedAt: new Date(),
        success: result.success,
        result: result.result,
        error: result.error,
        duration,
      };

      // Update task record
      await this.updateTaskExecution(userId, task.scheduledTaskId, executionRecord);

      if (result.success) {
        console.log(`✅ Task completed in ${duration}ms`);
      } else {
        console.error(`❌ Task failed: ${result.error}`);
      }

      // Schedule next run if recurring
      if (task.schedule.type === "recurring" || task.schedule.type === "conditional") {
        await this.rescheduleTask(userId, task);
      }
    } catch (error) {
      console.error(`Task execution failed: ${error}`);

      // Retry if under max retries
      if (task.retryCount < task.maxRetries) {
        const retryDelay = Math.pow(2, task.retryCount) * 60000; // Exponential backoff
        setTimeout(() => {
          task.retryCount++;
          this.executeScheduledTask(userId, task);
        }, retryDelay);
      }
    } finally {
      this.isRunning.delete(task.scheduledTaskId);
    }
  }

  /**
   * Calculate next run time from schedule
   */
  private calculateNextRunTime(schedule: TaskSchedule): Date {
    const now = new Date();

    switch (schedule.type) {
      case "once":
        return schedule.runsAt || new Date(now.getTime() + 60000);

      case "recurring":
        if (schedule.interval === "daily") {
          const next = new Date(now);
          next.setDate(next.getDate() + 1);
          if (schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(":").map(Number);
            next.setHours(hours, minutes, 0, 0);
          } else {
            next.setHours(0, 0, 0, 0);
          }
          return next;
        }

        if (schedule.interval === "weekly") {
          const next = new Date(now);
          const daysUntilTarget = ((schedule.dayOfWeek || 0) - next.getDay() + 7) % 7 || 7;
          next.setDate(next.getDate() + daysUntilTarget);
          if (schedule.timeOfDay) {
            const [hours, minutes] = schedule.timeOfDay.split(":").map(Number);
            next.setHours(hours, minutes, 0, 0);
          } else {
            next.setHours(0, 0, 0, 0);
          }
          return next;
        }

        if (schedule.interval === "hourly") {
          return new Date(now.getTime() + 60 * 60 * 1000);
        }

        if (schedule.interval === "every_2_hours") {
          return new Date(now.getTime() + 2 * 60 * 60 * 1000);
        }

        if (schedule.interval === "every_4_hours") {
          return new Date(now.getTime() + 4 * 60 * 60 * 1000);
        }

        // Default: 24 hours
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);

      case "conditional":
        // Re-check condition in 5 minutes
        return new Date(now.getTime() + 5 * 60 * 1000);

      default:
        return new Date(now.getTime() + 60000);
    }
  }

  /**
   * Update task execution record
   */
  private async updateTaskExecution(
    userId: string,
    scheduledTaskId: string,
    executionRecord: ExecutionRecord
  ): Promise<void> {
    try {
      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const q = query(tasksRef, where("scheduledTaskId", "==", scheduledTaskId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const currentData = docSnap.data();
        const history = currentData.executionHistory || [];

        await updateDoc(docSnap.ref, {
          lastRunAt: Timestamp.now(),
          executionHistory: [
            ...history,
            {
              ...executionRecord,
              executedAt: Timestamp.fromDate(executionRecord.executedAt),
            },
          ],
          retryCount: 0, // Reset on success
        });
      }
    } catch (error) {
      console.error("Failed to update task execution:", error);
    }
  }

  /**
   * Reschedule recurring task
   */
  private async rescheduleTask(
    userId: string,
    task: ScheduledTask
  ): Promise<void> {
    try {
      const nextRunAt = this.calculateNextRunTime(task.schedule);

      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const q = query(tasksRef, where("scheduledTaskId", "==", task.scheduledTaskId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        await updateDoc(docSnap.ref, {
          nextRunAt: Timestamp.fromDate(nextRunAt),
        });

        // Update in-memory task
        task.nextRunAt = nextRunAt;

        // Resume monitoring
        this.setupTaskMonitoring(userId, task);
      }
    } catch (error) {
      console.error("Failed to reschedule task:", error);
    }
  }

  /**
   * Cancel a scheduled task
   */
  async cancelScheduledTask(userId: string, scheduledTaskId: string): Promise<void> {
    try {
      const taskKey = `${userId}:${scheduledTaskId}`;
      const timer = this.executionTimers.get(taskKey);
      if (timer) {
        clearTimeout(timer);
        this.executionTimers.delete(taskKey);
      }

      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const q = query(tasksRef, where("scheduledTaskId", "==", scheduledTaskId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
      }

      console.log(`Task ${scheduledTaskId} cancelled`);
    } catch (error) {
      console.error("Failed to cancel scheduled task:", error);
    }
  }

  /**
   * Get all scheduled tasks for user
   */
  async getUserScheduledTasks(userId: string): Promise<ScheduledTask[]> {
    try {
      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const q = query(tasksRef, where("isActive", "==", true));
      const snapshot = await getDocs(q);

      const tasks: ScheduledTask[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tasks.push({
          ...data,
          nextRunAt: data.nextRunAt?.toDate?.() || new Date(),
          lastRunAt: data.lastRunAt?.toDate?.() || undefined,
        } as ScheduledTask);
      });

      return tasks;
    } catch (error) {
      console.error("Failed to get scheduled tasks:", error);
      return [];
    }
  }

  /**
   * Get execution history for a task
   */
  async getTaskExecutionHistory(
    userId: string,
    scheduledTaskId: string,
    limit: number = 20
  ): Promise<ExecutionRecord[]> {
    try {
      const tasksRef = collection(db, `users/${userId}/scheduledTasks`);
      const q = query(tasksRef, where("scheduledTaskId", "==", scheduledTaskId));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        return (data.executionHistory || [])
          .sort((a: any, b: any) => b.executedAt?.getTime?.() - a.executedAt?.getTime?.())
          .slice(0, limit);
      }

      return [];
    } catch (error) {
      console.error("Failed to get execution history:", error);
      return [];
    }
  }
}

export const autonomousTaskScheduler = AutonomousTaskSchedulerClass.getInstance();

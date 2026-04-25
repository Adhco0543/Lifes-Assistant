import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/public/src/lib/firebase";

export type TaskType =
  | "check_emails"
  | "find_jobs"
  | "generate_quote"
  | "create_material_list"
  | "send_email"
  | "follow_up"
  | "analyze_leads"
  | "custom";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface Task {
  id?: string;
  userId: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retries?: number;
  maxRetries?: number;
  nextRetryAt?: Date;
  metadata?: Record<string, unknown>;
}

export class TaskQueue {
  static readonly MAX_RETRIES = 3;
  static readonly RETRY_DELAY = 5 * 60 * 1000; // 5 minutes

  /**
   * Add a new task to queue
   */
  static async addTask(
    userId: string,
    type: TaskType,
    priority: TaskPriority,
    title: string,
    payload?: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    try {
      const task: Task = {
        userId,
        type,
        status: "pending",
        priority,
        title,
        description: payload?.description as string | undefined,
        payload,
        createdAt: new Date(),
        retries: 0,
        maxRetries: this.MAX_RETRIES,
        metadata,
      };

      const docRef = await addDoc(collection(db, "task_queue"), {
        ...task,
        createdAt: Timestamp.fromDate(task.createdAt),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error adding task to queue:", error);
      throw error;
    }
  }

  /**
   * Get pending tasks for user (sorted by priority and created time)
   */
  static async getPendingTasks(userId: string): Promise<Task[]> {
    try {
      // Simple query: just get by userId, filter and sort in memory to avoid composite indexes
      const q = query(
        collection(db, "task_queue"),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(q);
      let tasks = querySnapshot.docs.map((doc) => this.deserializeTask(doc));

      // Filter and custom sort by priority in memory
      const priorityOrder: Record<TaskPriority, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };

      tasks = tasks
        .filter(t => t.status === "pending")
        .sort(
          (a, b) =>
            priorityOrder[a.priority] - priorityOrder[b.priority] ||
            a.createdAt.getTime() - b.createdAt.getTime()
        );

      return tasks;
    } catch (error) {
      console.error("Error fetching pending tasks:", error);
      return [];
    }
  }

  /**
   * Get task by ID
   */
  static async getTask(taskId: string): Promise<Task | null> {
    try {
      const taskRef = doc(db, "task_queue", taskId);
      const snapshot = await getDoc(taskRef);

      if (!snapshot.exists()) {
        return null;
      }

      return this.deserializeTask(snapshot);
    } catch (error) {
      console.error("Error fetching task:", error);
      return null;
    }
  }

  /**
   * Update task status
   */
  static async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    result?: Record<string, unknown>,
    error?: string
  ): Promise<void> {
    try {
      const taskRef = doc(db, "task_queue", taskId);
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      if (status === "in_progress" && !result && !error) {
        updateData.startedAt = Timestamp.fromDate(new Date());
      } else if (status === "completed") {
        updateData.completedAt = Timestamp.fromDate(new Date());
        if (result) updateData.result = result;
      } else if (status === "failed") {
        updateData.error = error;
      }

      await updateDoc(taskRef, updateData);
    } catch (error) {
      console.error("Error updating task status:", error);
      throw error;
    }
  }

  /**
   * Retry a failed task
   */
  static async retryTask(taskId: string): Promise<boolean> {
    try {
      const task = await this.getTask(taskId);
      if (!task) return false;

      const retriesUsed = task.retries || 0;
      if (retriesUsed >= (task.maxRetries || this.MAX_RETRIES)) {
        return false; // Max retries exceeded
      }

      const taskRef = doc(db, "task_queue", taskId);
      await updateDoc(taskRef, {
        status: "pending",
        retries: retriesUsed + 1,
        nextRetryAt: Timestamp.fromDate(
          new Date(Date.now() + this.RETRY_DELAY)
        ),
        error: null,
        startedAt: null,
      });

      return true;
    } catch (error) {
      console.error("Error retrying task:", error);
      return false;
    }
  }

  /**
   * Get tasks by type
   */
  static async getTasksByType(userId: string, type: TaskType): Promise<Task[]> {
    try {
      const q = query(
        collection(db, "task_queue"),
        where("userId", "==", userId),
        where("type", "==", type)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => this.deserializeTask(doc));
    } catch (error) {
      console.error("Error fetching tasks by type:", error);
      return [];
    }
  }

  /**
   * Get task statistics for user
   */
  static async getTaskStats(userId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  }> {
    try {
      const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "failed"];
      const stats = {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
      };

      for (const status of statuses) {
        const q = query(
          collection(db, "task_queue"),
          where("userId", "==", userId),
          where("status", "==", status)
        );

        const querySnapshot = await getDocs(q);
        const count = querySnapshot.size;
        stats.total += count;

        if (status === "pending") stats.pending = count;
        else if (status === "in_progress") stats.inProgress = count;
        else if (status === "completed") stats.completed = count;
        else if (status === "failed") stats.failed = count;
      }

      return stats;
    } catch (error) {
      console.error("Error fetching task stats:", error);
      return { total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0 };
    }
  }

  /**
   * Get tasks with deadline/schedule
   */
  static async getScheduledTasks(userId: string): Promise<Task[]> {
    try {
      const q = query(
        collection(db, "task_queue"),
        where("userId", "==", userId),
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(q);
      const tasks = querySnapshot.docs
        .map((doc) => this.deserializeTask(doc))
        .filter((task) => task.metadata?.scheduledFor !== undefined);

      return tasks.sort(
        (a, b) =>
          new Date(a.metadata?.scheduledFor as string).getTime() -
          new Date(b.metadata?.scheduledFor as string).getTime()
      );
    } catch (error) {
      console.error("Error fetching scheduled tasks:", error);
      return [];
    }
  }

  /**
   * Batch update tasks (for bulk operations)
   */
  static async updateTaskBatch(
    updates: Array<{ taskId: string; status: TaskStatus; result?: Record<string, unknown> }>
  ): Promise<void> {
    try {
      for (const update of updates) {
        await this.updateTaskStatus(update.taskId, update.status, update.result);
      }
    } catch (error) {
      console.error("Error batch updating tasks:", error);
      throw error;
    }
  }

  /**
   * Delete completed tasks older than X days
   */
  static async cleanupOldTasks(userId: string, daysOld: number = 30): Promise<number> {
    try {
      const q = query(
        collection(db, "task_queue"),
        where("userId", "==", userId),
        where("status", "==", "completed")
      );

      const querySnapshot = await getDocs(q);
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      // Note: Firestore doesn't support bulk delete in web SDK, so this is a placeholder
      // In production, you'd use batch operations or a Cloud Function
      querySnapshot.docs.forEach((taskDoc) => {
        const task = this.deserializeTask(taskDoc);
        if (task.completedAt && task.completedAt < cutoffDate) {
          deletedCount++;
        }
      });

      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up old tasks:", error);
      return 0;
    }
  }

  /**
   * Private: Deserialize Firestore task document
   */
  private static deserializeTask(doc: any): Task {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      type: data.type,
      status: data.status,
      priority: data.priority,
      title: data.title,
      description: data.description,
      payload: data.payload,
      result: data.result,
      error: data.error,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      startedAt: data.startedAt?.toDate?.(),
      completedAt: data.completedAt?.toDate?.(),
      retries: data.retries,
      maxRetries: data.maxRetries,
      nextRetryAt: data.nextRetryAt?.toDate?.(),
      metadata: data.metadata,
    };
  }
}

export default TaskQueue;

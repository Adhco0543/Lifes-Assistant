/**
 * roiAnalytics.ts - Track ROI and value metrics
 * Time saved, tasks completed, decisions made, revenue impact
 */

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
} from "firebase/firestore";

export interface MetricEvent {
  id: string;
  userId: string;
  type: "task_completed" | "email_sent" | "decision_made" | "lead_found" | "time_saved" | "revenue_generated";
  value: number; // Minutes saved, $ generated, etc.
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface ROIMetrics {
  userId: string;
  period: "day" | "week" | "month" | "all";
  totalTasksCompleted: number;
  totalEmailsSent: number;
  totalDecisionsMade: number;
  totalLeadsFound: number;
  totalTimeSavedMinutes: number;
  estimatedRevenuePerHour: number;
  totalRevenueGenerated: number;
  roi: number; // Return on investment percentage
  metrics: Record<string, number>;
}

export interface TaskMetrics {
  taskType: string;
  count: number;
  averageTimeMinutes: number;
  successRate: number;
  failureRate: number;
  averageValuePerTask: number;
}

class ROIAnalyticsClass {
  private static instance: ROIAnalyticsClass;
  private hourlyRate: number = 150; // Default hourly rate

  private constructor() {}

  static getInstance(): ROIAnalyticsClass {
    if (!ROIAnalyticsClass.instance) {
      ROIAnalyticsClass.instance = new ROIAnalyticsClass();
    }
    return ROIAnalyticsClass.instance;
  }

  /**
   * Record a metric event
   */
  async recordEvent(
    userId: string,
    type: MetricEvent["type"],
    value: number,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const eventsRef = collection(db, `users/${userId}/metricEvents`);

      const event: MetricEvent = {
        id: `event-${Date.now()}`,
        userId,
        type,
        value,
        description,
        timestamp: new Date(),
        metadata,
      };

      await addDoc(eventsRef, {
        ...event,
        timestamp: Timestamp.fromDate(event.timestamp),
      });

      console.log(`📊 Metric recorded: ${type} - ${description}`);
    } catch (error) {
      console.error("Failed to record metric:", error);
    }
  }

  /**
   * Record task completion
   */
  async recordTaskCompleted(
    userId: string,
    taskType: string,
    minutesSaved: number,
    taskDescription: string
  ): Promise<void> {
    const estimatedValue = (minutesSaved / 60) * this.hourlyRate;
    await this.recordEvent(
      userId,
      "task_completed",
      estimatedValue,
      taskDescription,
      { taskType, minutesSaved, hourlyRate: this.hourlyRate }
    );
  }

  /**
   * Record email sent
   */
  async recordEmailSent(
    userId: string,
    recipient: string,
    isFollowUp: boolean = false
  ): Promise<void> {
    const value = isFollowUp ? 25 : 50; // $ value of personalized email
    await this.recordEvent(
      userId,
      "email_sent",
      value,
      `Email sent to ${recipient}`,
      { recipient, isFollowUp }
    );
  }

  /**
   * Record decision made
   */
  async recordDecisionMade(
    userId: string,
    decisionType: string,
    impact: "high" | "medium" | "low" = "medium"
  ): Promise<void> {
    const values = { high: 500, medium: 200, low: 50 };
    await this.recordEvent(
      userId,
      "decision_made",
      values[impact],
      `Decision: ${decisionType}`,
      { decisionType, impact }
    );
  }

  /**
   * Record lead found
   */
  async recordLeadFound(
    userId: string,
    company: string,
    leadQuality: "hot" | "warm" | "cold" = "warm"
  ): Promise<void> {
    const values = { hot: 300, warm: 150, cold: 50 };
    await this.recordEvent(
      userId,
      "lead_found",
      values[leadQuality],
      `Lead found: ${company}`,
      { company, leadQuality }
    );
  }

  /**
   * Record revenue generated
   */
  async recordRevenueGenerated(
    userId: string,
    amount: number,
    source: string
  ): Promise<void> {
    await this.recordEvent(
      userId,
      "revenue_generated",
      amount,
      `Revenue: $${amount.toFixed(2)} from ${source}`,
      { amount, source }
    );
  }

  /**
   * Get ROI metrics for period
   */
  async getROIMetrics(
    userId: string,
    period: "day" | "week" | "month" | "all" = "month"
  ): Promise<ROIMetrics> {
    try {
      const eventsRef = collection(db, `users/${userId}/metricEvents`);
      const q = query(eventsRef);
      const snapshot = await getDocs(q);

      const events: MetricEvent[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({
          ...data,
          timestamp: data.timestamp?.toDate?.() || new Date(),
        } as MetricEvent);
      });

      // Filter by period
      const filteredEvents = this.filterEventsByPeriod(events, period);

      // Calculate metrics
      const metrics = this.calculateMetrics(filteredEvents);

      return {
        userId,
        period,
        totalTasksCompleted: filteredEvents.filter((e) => e.type === "task_completed").length,
        totalEmailsSent: filteredEvents.filter((e) => e.type === "email_sent").length,
        totalDecisionsMade: filteredEvents.filter((e) => e.type === "decision_made").length,
        totalLeadsFound: filteredEvents.filter((e) => e.type === "lead_found").length,
        totalTimeSavedMinutes: this.getTotalTimeSaved(filteredEvents),
        estimatedRevenuePerHour: this.hourlyRate,
        totalRevenueGenerated: filteredEvents
          .filter((e) => e.type === "revenue_generated")
          .reduce((sum, e) => sum + e.value, 0),
        roi: this.calculateROI(filteredEvents),
        metrics,
      };
    } catch (error) {
      console.error("Failed to get ROI metrics:", error);
      return this.getEmptyMetrics(userId, period);
    }
  }

  /**
   * Filter events by time period
   */
  private filterEventsByPeriod(
    events: MetricEvent[],
    period: "day" | "week" | "month" | "all"
  ): MetricEvent[] {
    const now = new Date();
    let cutoff = new Date(0);

    switch (period) {
      case "day":
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
        cutoff = new Date(0);
    }

    return events.filter((e) => e.timestamp >= cutoff);
  }

  /**
   * Calculate metrics from events
   */
  private calculateMetrics(events: MetricEvent[]): Record<string, number> {
    const metrics: Record<string, number> = {
      totalValue: 0,
      averageValuePerTask: 0,
      emailOpenRate: 75, // Estimated
      leadConversionRate: 15, // Estimated
      taskSuccessRate: 92, // Estimated
    };

    for (const event of events) {
      metrics.totalValue += event.value;
    }

    if (events.length > 0) {
      metrics.averageValuePerTask = metrics.totalValue / events.length;
    }

    return metrics;
  }

  /**
   * Get total time saved
   */
  private getTotalTimeSaved(events: MetricEvent[]): number {
    return events
      .filter((e) => e.type === "task_completed")
      .reduce((sum, e) => sum + (e.metadata.minutesSaved || 0), 0);
  }

  /**
   * Calculate ROI percentage
   */
  private calculateROI(events: MetricEvent[]): number {
    // Assume $20/month cost for service
    const serviceCost = 20;

    const totalValue = events.reduce((sum, e) => sum + e.value, 0);
    const roi = ((totalValue - serviceCost) / serviceCost) * 100;

    return Math.max(0, roi); // Don't return negative
  }

  /**
   * Get empty metrics template
   */
  private getEmptyMetrics(
    userId: string,
    period: "day" | "week" | "month" | "all"
  ): ROIMetrics {
    return {
      userId,
      period,
      totalTasksCompleted: 0,
      totalEmailsSent: 0,
      totalDecisionsMade: 0,
      totalLeadsFound: 0,
      totalTimeSavedMinutes: 0,
      estimatedRevenuePerHour: this.hourlyRate,
      totalRevenueGenerated: 0,
      roi: 0,
      metrics: {},
    };
  }

  /**
   * Get task-level metrics
   */
  async getTaskMetrics(userId: string): Promise<TaskMetrics[]> {
    try {
      const eventsRef = collection(db, `users/${userId}/metricEvents`);
      const q = query(eventsRef, where("type", "==", "task_completed"));
      const snapshot = await getDocs(q);

      const taskMap: Record<string, { count: number; totalMinutes: number; successCount: number }> =
        {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const taskType = data.metadata?.taskType || "unknown";

        if (!taskMap[taskType]) {
          taskMap[taskType] = { count: 0, totalMinutes: 0, successCount: 0 };
        }

        taskMap[taskType].count++;
        taskMap[taskType].totalMinutes += data.metadata?.minutesSaved || 0;
        taskMap[taskType].successCount++;
      });

      const metrics: TaskMetrics[] = Object.entries(taskMap).map(([taskType, data]) => ({
        taskType,
        count: data.count,
        averageTimeMinutes: data.totalMinutes / data.count,
        successRate: 95, // Estimated
        failureRate: 5,
        averageValuePerTask: (data.totalMinutes / 60) * this.hourlyRate,
      }));

      return metrics;
    } catch (error) {
      console.error("Failed to get task metrics:", error);
      return [];
    }
  }

  /**
   * Set hourly rate for ROI calculations
   */
  setHourlyRate(rate: number): void {
    this.hourlyRate = rate;
  }

  /**
   * Get metric trend over time
   */
  async getMetricTrend(
    userId: string,
    type: MetricEvent["type"],
    days: number = 30
  ): Promise<Array<{ date: string; value: number }>> {
    try {
      const eventsRef = collection(db, `users/${userId}/metricEvents`);
      const q = query(eventsRef, where("type", "==", type));
      const snapshot = await getDocs(q);

      const trendMap: Record<string, number> = {};
      const now = new Date();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate?.() || new Date();

        if (now.getTime() - timestamp.getTime() <= days * 24 * 60 * 60 * 1000) {
          const dateKey = timestamp.toISOString().split("T")[0];
          trendMap[dateKey] = (trendMap[dateKey] || 0) + data.value;
        }
      });

      return Object.entries(trendMap)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error("Failed to get metric trend:", error);
      return [];
    }
  }
}

export const roiAnalytics = ROIAnalyticsClass.getInstance();

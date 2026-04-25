/**
 * User Behavior Tracking and Pattern Analysis
 * Tracks user interactions and analyzes behavioral patterns
 */

export interface UserInteraction {
  id: string;
  userId: string;
  action: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  lastOccurred: number;
  confidence: number;
}

class InteractionTracker {
  private interactions: UserInteraction[] = [];
  private patterns: Map<string, BehaviorPattern> = new Map();

  /**
   * Track a user interaction
   */
  trackInteraction(
    userId: string,
    action: string,
    duration?: number,
    metadata?: Record<string, any>
  ): UserInteraction {
    const interaction: UserInteraction = {
      id: `${userId}-${Date.now()}-${Math.random()}`,
      userId,
      action,
      timestamp: Date.now(),
      duration,
      metadata,
    };

    this.interactions.push(interaction);
    this.analyzePattern(action);

    return interaction;
  }

  /**
   * Analyze behavioral patterns
   */
  private analyzePattern(action: string): void {
    const existing = this.patterns.get(action);

    if (existing) {
      existing.frequency += 1;
      existing.lastOccurred = Date.now();
      existing.confidence = Math.min(existing.frequency / 100, 1);
    } else {
      this.patterns.set(action, {
        pattern: action,
        frequency: 1,
        lastOccurred: Date.now(),
        confidence: 0.01,
      });
    }
  }

  /**
   * Get interaction history for a user
   */
  getInteractionHistory(userId: string, limit: number = 50): UserInteraction[] {
    return this.interactions
      .filter((i) => i.userId === userId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get identified behavior patterns
   */
  getPatterns(minConfidence: number = 0.1): BehaviorPattern[] {
    return Array.from(this.patterns.values())
      .filter((p) => p.confidence >= minConfidence)
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get user behavior summary
   */
  getUserBehaviorSummary(userId: string): Record<string, any> {
    const userInteractions = this.interactions.filter((i) => i.userId === userId);
    const actions = userInteractions.map((i) => i.action);
    const actionCounts = actions.reduce(
      (acc, action) => {
        acc[action] = (acc[action] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalInteractions: userInteractions.length,
      uniqueActions: Object.keys(actionCounts).length,
      actionBreakdown: actionCounts,
      lastActive: userInteractions[0]?.timestamp || null,
    };
  }

  /**
   * Clear old interactions (older than specified days)
   */
  clearOldInteractions(daysOld: number = 30): void {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    this.interactions = this.interactions.filter((i) => i.timestamp > cutoffTime);
  }
}

export const interactionTracker = new InteractionTracker();

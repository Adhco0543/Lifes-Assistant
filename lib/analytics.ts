/**
 * Analytics & Engagement Tracking
 * Tracks user interactions to inform personalization and recommendations
 */

export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType: string;
  category: string;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface EngagementMetrics {
  sessionCount: number;
  totalTimeSpent: number;
  averageSessionDuration: number;
  bounceRate: number;
  completionRate: number;
  mostEngagedFeatures: Array<{ feature: string; interactions: number }>;
}

class AnalyticsTracker {
  private events: AnalyticsEvent[] = [];
  private storageKey = 'app_analytics_events';
  private sessionStart: number = Date.now();
  private sessionEvents: number = 0;

  /**
   * Track an event
   */
  trackEvent(
    userId: string,
    eventType: string,
    category: string,
    metadata: Record<string, any> = {}
  ): AnalyticsEvent {
    const event: AnalyticsEvent = {
      id: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      eventType,
      category,
      timestamp: Date.now(),
      metadata,
    };

    this.events.push(event);
    this.sessionEvents += 1;

    this.persistEvents();
    return event;
  }

  /**
   * Track page view
   */
  trackPageView(userId: string, pageName: string, metadata?: Record<string, any>): void {
    this.trackEvent(userId, 'page_view', 'navigation', {
      pageName,
      ...metadata,
    });
  }

  /**
   * Track form interaction
   */
  trackFormInteraction(
    userId: string,
    formName: string,
    action: 'start' | 'input' | 'submit' | 'error',
    metadata?: Record<string, any>
  ): void {
    this.trackEvent(userId, action, 'form', {
      formName,
      ...metadata,
    });
  }

  /**
   * Track feature usage
   */
  trackFeatureUsage(
    userId: string,
    featureName: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    this.trackEvent(userId, action, 'feature', {
      featureName,
      ...metadata,
    });
  }

  /**
   * Track user action with timing
   */
  trackTimedAction(
    userId: string,
    actionName: string,
    category: string,
    durationMs: number,
    metadata?: Record<string, any>
  ): void {
    const event = this.trackEvent(userId, actionName, category, metadata);
    event.duration = durationMs;
    this.persistEvents();
  }

  /**
   * Get engagement metrics for user
   */
  getEngagementMetrics(userId: string): EngagementMetrics {
    const userEvents = this.events.filter((e) => e.userId === userId);

    const sessionCount = userEvents.filter(
      (e) => e.eventType === 'page_view'
    ).length;

    const totalTimeSpent = userEvents.reduce(
      (sum, e) => sum + (e.duration || 0),
      0
    );

    const averageSessionDuration = sessionCount > 0 ? totalTimeSpent / sessionCount : 0;

    const bounceRate = this.calculateBounceRate(userEvents);
    const completionRate = this.calculateCompletionRate(userEvents);

    const featureCounts: Record<string, number> = {};
    userEvents
      .filter((e) => e.category === 'feature')
      .forEach((e) => {
        const feature = e.metadata?.featureName || 'unknown';
        featureCounts[feature] = (featureCounts[feature] || 0) + 1;
      });

    const mostEngagedFeatures = Object.entries(featureCounts)
      .map(([feature, interactions]) => ({ feature, interactions }))
      .sort((a, b) => b.interactions - a.interactions)
      .slice(0, 5);

    return {
      sessionCount,
      totalTimeSpent,
      averageSessionDuration,
      bounceRate,
      completionRate,
      mostEngagedFeatures,
    };
  }

  /**
   * Calculate bounce rate (sessions with only 1 event)
   */
  private calculateBounceRate(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 0;

    const pageViews = events.filter((e) => e.eventType === 'page_view');
    const sessionIds = new Set(pageViews.map((e) => e.metadata?.sessionId));

    let bounces = 0;
    sessionIds.forEach((sessionId) => {
      const sessionEvents = events.filter(
        (e) => e.metadata?.sessionId === sessionId
      );
      if (sessionEvents.length === 1) {
        bounces += 1;
      }
    });

    return sessionIds.size > 0 ? bounces / sessionIds.size : 0;
  }

  /**
   * Calculate completion rate
   */
  private calculateCompletionRate(events: AnalyticsEvent[]): number {
    if (events.length === 0) return 0;

    const completions = events.filter(
      (e) => e.eventType === 'submit' || e.eventType === 'complete'
    ).length;

    const starts = events.filter(
      (e) => e.eventType === 'start'
    ).length;

    return starts > 0 ? completions / starts : 0;
  }

  /**
   * Get feature adoption rate
   */
  getFeatureAdoption(userId: string, featureName: string): number {
    const userEvents = this.events.filter((e) => e.userId === userId);
    const featureEvents = userEvents.filter(
      (e) => e.metadata?.featureName === featureName
    );

    return featureEvents.length / Math.max(userEvents.length, 1);
  }

  /**
   * Get time trend data
   */
  getTimeTrendData(
    userId: string,
    timeWindowDays: number = 7
  ): Array<{ date: string; events: number; duration: number }> {
    const cutoffTime = Date.now() - timeWindowDays * 24 * 60 * 60 * 1000;
    const userEvents = this.events.filter(
      (e) => e.userId === userId && e.timestamp > cutoffTime
    );

    const trendData: Record<string, { events: number; duration: number }> = {};

    userEvents.forEach((event) => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      if (!trendData[date]) {
        trendData[date] = { events: 0, duration: 0 };
      }
      trendData[date].events += 1;
      trendData[date].duration += event.duration || 0;
    });

    return Object.entries(trendData)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Get heatmap data (most common interaction paths)
   */
  getInteractionPaths(userId: string, limit: number = 10): Array<string[]> {
    const userEvents = this.events
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.timestamp - b.timestamp);

    const paths: Record<string, number> = {};

    for (let i = 0; i < userEvents.length - 1; i++) {
      const path = `${userEvents[i].eventType}→${userEvents[i + 1].eventType}`;
      paths[path] = (paths[path] || 0) + 1;
    }

    return Object.entries(paths)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path]) => path.split('→'));
  }

  /**
   * Persist events to localStorage
   */
  private persistEvents(): void {
    try {
      const toStore = this.events.slice(-1000); // Keep last 1000 events
      localStorage.setItem(this.storageKey, JSON.stringify(toStore));
    } catch (e) {
      console.warn('Failed to persist analytics events:', e);
    }
  }

  /**
   * Load events from localStorage
   */
  loadPersistedEvents(userId: string): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.events = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load analytics events:', e);
    }
  }

  /**
   * Clear analytics for user
   */
  clearAnalytics(userId: string): void {
    this.events = this.events.filter((e) => e.userId !== userId);
    this.persistEvents();
  }

  /**
   * Get all events for debugging
   */
  getAllEvents(userId: string): AnalyticsEvent[] {
    return this.events.filter((e) => e.userId === userId);
  }
}

export const analyticsTracker = new AnalyticsTracker();

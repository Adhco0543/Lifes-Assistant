/**
 * Integration Utilities
 * Helper functions and configuration for easy setup of all personalization systems
 */

import { personalizationEngine } from './personalization';
import { analyticsTracker } from './analytics';
import { interactionTracker } from './interactions';
import { aiScorer } from './aiScoring';

/**
 * App Configuration
 */
export const appConfig = {
  analytics: {
    enabled: true,
    trackingId: 'app_analytics_v1',
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  },
  personalization: {
    enabled: true,
    adaptiveUIEnabled: true,
    learningEnabled: true,
    minDataPointsForAdaptation: 10,
  },
  features: {
    realtimeFeedback: true,
    progressiveOnboarding: true,
    aiRecommendations: true,
    richMedia: true,
    userPreferences: true,
  },
};

/**
 * Initialize app systems for a user
 */
export async function initializeAppSystems(userId: string): Promise<void> {
  // Load personalization profile
  personalizationEngine.getOrCreateProfile(userId);

  // Load analytics data
  analyticsTracker.loadPersistedEvents(userId);

  // Initialize interaction tracker
  const history = interactionTracker.getInteractionHistory(userId, 1);

  console.log(`[App] Initialized systems for user: ${userId}`);
}

/**
 * Get comprehensive app state
 */
export function getAppState(userId: string): AppState {
  const profile = personalizationEngine.getOrCreateProfile(userId);
  const metrics = analyticsTracker.getEngagementMetrics(userId);
  const learningMetrics = personalizationEngine.getLearningMetrics(userId);
  const adaptiveConfig = personalizationEngine.getAdaptiveConfig(userId);

  return {
    userId,
    userProfile: profile,
    engagementMetrics: metrics,
    learningMetrics,
    adaptiveConfig,
    timestamp: Date.now(),
  };
}

/**
 * Get feature recommendations based on user behavior
 */
export function getFeatureRecommendations(userId: string, limit: number = 5): FeatureRecommendation[] {
  const profile = personalizationEngine.getOrCreateProfile(userId);
  const metrics = analyticsTracker.getEngagementMetrics(userId);

  const recommendations: FeatureRecommendation[] = [];

  // Recommend animations if high engagement
  if (metrics.completionRate > 0.7) {
    recommendations.push({
      feature: 'enhanced_animations',
      priority: 0.9,
      reason: 'High engagement detected - enhanced animations recommended',
    });
  }

  // Recommend personalized content if user has patterns
  if (profile.learningData.commonActions.length > 20) {
    recommendations.push({
      feature: 'personalized_content',
      priority: 0.85,
      reason: 'Sufficient interaction data - personalization can be enhanced',
    });
  }

  // Recommend AI recommendations if user is frequent user
  if (metrics.sessionCount > 3) {
    recommendations.push({
      feature: 'ai_recommendations',
      priority: 0.8,
      reason: 'Returning user - AI recommendations will be useful',
    });
  }

  // Recommend content skipping if user shows impatience
  if (
    profile.learningData.engagementLevel > 0.8 &&
    metrics.averageSessionDuration > 120000
  ) {
    recommendations.push({
      feature: 'skip_optional',
      priority: 0.75,
      reason: 'Fast-paced user - skip optional content recommended',
    });
  }

  return aiScorer
    .rankRecommendations(recommendations as any)
    .slice(0, limit) as any;
}

/**
 * Generate user insights report
 */
export function generateUserInsightsReport(userId: string): UserInsightsReport {
  const profile = personalizationEngine.getOrCreateProfile(userId);
  const metrics = analyticsTracker.getEngagementMetrics(userId);
  const timeTrend = analyticsTracker.getTimeTrendData(userId, 7);
  const interactionPaths = analyticsTracker.getInteractionPaths(userId, 5);

  const engagementTrend = timeTrend.map((day) => ({
    date: day.date,
    engagement: (day.events / Math.max(...timeTrend.map((d) => d.events))) * 100,
  }));

  return {
    userId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalInteractions: metrics.sessionCount,
      averageSessionTime: `${Math.round(metrics.averageSessionDuration / 1000)}s`,
      completionRate: `${(metrics.completionRate * 100).toFixed(0)}%`,
      engagementLevel: `${(profile.learningData.engagementLevel * 100).toFixed(0)}%`,
    },
    topFeatures: metrics.mostEngagedFeatures,
    engagementTrend,
    interactionPaths,
    recommendations: getFeatureRecommendations(userId, 3),
    nextActions: generateNextActions(profile, metrics),
  };
}

/**
 * Generate personalized next actions
 */
function generateNextActions(
  profile: any,
  metrics: any
): string[] {
  const actions: string[] = [];

  if (metrics.completionRate < 0.5) {
    actions.push('Encourage user to complete more tasks');
  }

  if (profile.learningData.engagementLevel < 0.5) {
    actions.push('Simplify content and reduce cognitive load');
  }

  if (metrics.sessionCount === 1) {
    actions.push('Send welcome email with tips and tutorials');
  }

  if (profile.preferences.contentPace === 'fast') {
    actions.push('Offer advanced features and shortcuts');
  }

  if (metrics.mostEngagedFeatures.length > 0) {
    const topFeature = metrics.mostEngagedFeatures[0];
    actions.push(`Expand ${topFeature.feature} to deepen engagement`);
  }

  return actions;
}

/**
 * Track critical user milestones
 */
export function trackMilestone(
  userId: string,
  milestoneName: string,
  metadata?: Record<string, any>
): void {
  analyticsTracker.trackEvent(userId, milestoneName, 'milestone', metadata);
  personalizationEngine.recordInteraction(userId, milestoneName, metadata);

  console.log(`[Milestone] ${userId} reached: ${milestoneName}`);
}

/**
 * Reset user profile (for testing or user request)
 */
export function resetUserProfile(userId: string): void {
  personalizationEngine.clearProfile(userId);
  analyticsTracker.clearAnalytics(userId);

  console.log(`[Reset] Profile cleared for user: ${userId}`);
}

/**
 * Export user data (GDPR compliance)
 */
export function exportUserData(userId: string): UserDataExport {
  return {
    profile: personalizationEngine.exportUserData(userId),
    interactions: interactionTracker.getInteractionHistory(userId, 1000),
    analytics: analyticsTracker.getAllEvents(userId),
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Type definitions
 */
export interface AppState {
  userId: string;
  userProfile: any;
  engagementMetrics: any;
  learningMetrics: any;
  adaptiveConfig: any;
  timestamp: number;
}

export interface FeatureRecommendation {
  feature: string;
  priority: number;
  reason: string;
}

export interface UserInsightsReport {
  userId: string;
  generatedAt: string;
  summary: {
    totalInteractions: number;
    averageSessionTime: string;
    completionRate: string;
    engagementLevel: string;
  };
  topFeatures: Array<{ feature: string; interactions: number }>;
  engagementTrend: Array<{ date: string; engagement: number }>;
  interactionPaths: string[][];
  recommendations: FeatureRecommendation[];
  nextActions: string[];
}

export interface UserDataExport {
  profile: any;
  interactions: any[];
  analytics: any[];
  exportedAt: string;
}

/**
 * Debug utilities
 */
export const debug = {
  logState: (userId: string) => {
    console.log('=== App State ===');
    console.log(getAppState(userId));
  },
  
  logReport: (userId: string) => {
    console.log('=== User Insights ===');
    console.log(generateUserInsightsReport(userId));
  },

  logProfile: (userId: string) => {
    console.log('=== User Profile ===');
    console.log(personalizationEngine.exportUserData(userId));
  },

  clearAll: (userId: string) => {
    console.warn('Clearing all user data...');
    resetUserProfile(userId);
  },
};

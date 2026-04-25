/**
 * Integration Hooks
 * React hooks for easy integration with personalization and analytics
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { personalizationEngine, UserProfile } from './personalization';
import { analyticsTracker, EngagementMetrics } from './analytics';
import { interactionTracker } from './interactions';
import { aiScorer } from './aiScoring';

/**
 * Hook: Use user personalization context
 */
export function usePersonalization(userId: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const userProfile = personalizationEngine.getOrCreateProfile(userId);
    setProfile(userProfile);

    const adaptiveConfig = personalizationEngine.getAdaptiveConfig(userId);
    setConfig(adaptiveConfig);
  }, [userId]);

  const updatePreferences = useCallback(
    (preferences: any) => {
      const updated = personalizationEngine.updatePreferences(userId, preferences);
      setProfile(updated);
      setConfig(personalizationEngine.getAdaptiveConfig(userId));
    },
    [userId]
  );

  const recordInteraction = useCallback(
    (action: string, metadata?: any) => {
      personalizationEngine.recordInteraction(userId, action, metadata);
      const updated = personalizationEngine.getOrCreateProfile(userId);
      setProfile(updated);
    },
    [userId]
  );

  return {
    profile,
    config,
    updatePreferences,
    recordInteraction,
    metrics: profile ? personalizationEngine.getLearningMetrics(userId) : null,
  };
}

/**
 * Hook: Use analytics tracking
 */
export function useAnalytics(userId: string, pageName?: string) {
  const pageTrackingDone = useRef(false);

  useEffect(() => {
    if (!pageTrackingDone.current && pageName) {
      analyticsTracker.trackPageView(userId, pageName);
      pageTrackingDone.current = true;
    }
  }, [userId, pageName]);

  const trackEvent = useCallback(
    (eventType: string, category: string, metadata?: any) => {
      return analyticsTracker.trackEvent(userId, eventType, category, metadata);
    },
    [userId]
  );

  const trackFormInteraction = useCallback(
    (formName: string, action: 'start' | 'input' | 'submit' | 'error', metadata?: any) => {
      analyticsTracker.trackFormInteraction(userId, formName, action, metadata);
    },
    [userId]
  );

  const trackFeatureUsage = useCallback(
    (featureName: string, action: string, metadata?: any) => {
      analyticsTracker.trackFeatureUsage(userId, featureName, action, metadata);
    },
    [userId]
  );

  const trackTimedAction = useCallback(
    (actionName: string, category: string, durationMs: number, metadata?: any) => {
      analyticsTracker.trackTimedAction(userId, actionName, category, durationMs, metadata);
    },
    [userId]
  );

  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);

  const getMetrics = useCallback(() => {
    const m = analyticsTracker.getEngagementMetrics(userId);
    setMetrics(m);
    return m;
  }, [userId]);

  return {
    trackEvent,
    trackFormInteraction,
    trackFeatureUsage,
    trackTimedAction,
    getMetrics,
    metrics,
  };
}

/**
 * Hook: Use interaction tracking
 */
export function useInteractionTracking(userId: string) {
  const trackInteraction = useCallback(
    (action: string, duration?: number, metadata?: any) => {
      return interactionTracker.trackInteraction(userId, action, duration, metadata);
    },
    [userId]
  );

  const getHistory = useCallback(
    (limit?: number) => {
      return interactionTracker.getInteractionHistory(userId, limit);
    },
    [userId]
  );

  const getSummary = useCallback(() => {
    return interactionTracker.getUserBehaviorSummary(userId);
  }, [userId]);

  return {
    trackInteraction,
    getHistory,
    getSummary,
  };
}

/**
 * Hook: Use AI scoring and recommendations
 */
export function useAIRecommendations() {
  const scoreRecommendation = useCallback((recommendation: any, criteria?: any) => {
    return aiScorer.scoreRecommendation(recommendation, criteria);
  }, []);

  const rankRecommendations = useCallback(
    (recommendations: any[], userBehavior?: any, userPreferences?: any) => {
      return aiScorer.rankRecommendations(
        recommendations,
        userBehavior,
        userPreferences
      );
    },
    []
  );

  const getScoreExplanation = useCallback((recommendation: any, criteria?: any) => {
    return aiScorer.getScoreExplanation(recommendation, criteria);
  }, []);

  return {
    scoreRecommendation,
    rankRecommendations,
    getScoreExplanation,
  };
}

/**
 * Hook: Combined integration - all systems together
 */
export function useAppIntegration(userId: string) {
  const personalization = usePersonalization(userId);
  const analytics = useAnalytics(userId);
  const interactions = useInteractionTracking(userId);
  const recommendations = useAIRecommendations();

  /**
   * Track user action with full integration
   */
  const trackUserAction = useCallback(
    (
      action: string,
      category: string,
      metadata: any = {},
      durationMs?: number
    ) => {
      // Track in all systems
      analytics.trackEvent(action, category, metadata);
      interactions.trackInteraction(action, durationMs, metadata);
      personalization.recordInteraction(action, {
        category,
        ...metadata,
      });
    },
    [analytics, interactions, personalization]
  );

  /**
   * Track form submission with validation
   */
  const trackFormSubmission = useCallback(
    (
      formName: string,
      formData: Record<string, any>,
      isValid: boolean = true
    ) => {
      analytics.trackFormInteraction(formName, isValid ? 'submit' : 'error', {
        fieldCount: Object.keys(formData).length,
        ...formData,
      });

      if (isValid) {
        personalization.recordInteraction('form_submit', {
          formName,
          section: formName,
          timeSpent: 0,
        });
      }
    },
    [analytics, personalization]
  );

  /**
   * Get personalized experience
   */
  const getPersonalizedExperience = useCallback(() => {
    return {
      ...personalization.config,
      metrics: personalization.metrics,
      engagementMetrics: analytics.metrics,
    };
  }, [personalization, analytics]);

  return {
    personalization,
    analytics,
    interactions,
    recommendations,
    trackUserAction,
    trackFormSubmission,
    getPersonalizedExperience,
  };
}

/**
 * Hook: Use responsive design breakpoints
 */
export function useResponsive() {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isTablet, setIsTablet] = useState<boolean>(false);
  const [isDesktop, setIsDesktop] = useState<boolean>(true);
  const [screenWidth, setScreenWidth] = useState<number>(0);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenWidth(width);
      setIsMobile(width < 640);
      setIsTablet(width >= 640 && width < 1024);
      setIsDesktop(width >= 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isTablet,
    isDesktop,
    screenWidth,
    breakpoint: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
  };
}

/**
 * Hook: Debounced callback for performance
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  ) as T;
}

/**
 * Hook: Track component mount/unmount
 */
export function useComponentTracking(componentName: string, userId: string) {
  const analytics = useAnalytics(userId);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    analytics.trackFeatureUsage(componentName, 'mount');

    return () => {
      const duration = Date.now() - startTimeRef.current;
      analytics.trackFeatureUsage(componentName, 'unmount', { duration });
      analytics.trackTimedAction(
        `${componentName}_session`,
        'component',
        duration
      );
    };
  }, [componentName, userId, analytics]);
}

/**
 * Progressive Personalization Engine
 * Adapts the app experience based on user interactions over time
 */

export interface UserProfile {
  userId: string;
  createdAt: number;
  lastUpdated: number;
  behaviorScore: number;
  preferences: {
    theme?: 'light' | 'dark';
    contentPace?: 'slow' | 'medium' | 'fast';
    interactionStyle?: 'text' | 'visual' | 'conversational';
    skipOptional?: boolean;
    notificationFrequency?: 'high' | 'medium' | 'low';
  };
  adaptations: {
    suggestionsEnabled: boolean;
    animationsEnabled: boolean;
    mobileOptimized: boolean;
    personalizedContent: boolean;
  };
  learningData: {
    commonActions: string[];
    engagementLevel: number;
    completionRate: number;
    timeSpentPerSection: Record<string, number>;
    preferredContentTypes: string[];
  };
}

export interface PersonalizationContext {
  userProfile: UserProfile;
  sessionData: {
    startTime: number;
    interactions: number;
    completedSections: string[];
  };
}

class PersonalizationEngine {
  private storageKey = 'app_user_profile';
  private sessionKey = 'app_session_data';

  /**
   * Initialize or retrieve user profile
   */
  getOrCreateProfile(userId: string): UserProfile {
    const stored = this.getStoredProfile();

    if (stored && stored.userId === userId) {
      return stored;
    }

    const newProfile: UserProfile = {
      userId,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      behaviorScore: 0.5,
      preferences: {
        theme: 'light',
        contentPace: 'medium',
        interactionStyle: 'conversational',
        skipOptional: false,
        notificationFrequency: 'medium',
      },
      adaptations: {
        suggestionsEnabled: true,
        animationsEnabled: true,
        mobileOptimized: true,
        personalizedContent: true,
      },
      learningData: {
        commonActions: [],
        engagementLevel: 0.5,
        completionRate: 0,
        timeSpentPerSection: {},
        preferredContentTypes: [],
      },
    };

    this.saveProfile(newProfile);
    return newProfile;
  }

  /**
   * Record user interaction and update profile
   */
  recordInteraction(
    userId: string,
    action: string,
    metadata: Record<string, any> = {}
  ): void {
    const profile = this.getOrCreateProfile(userId);

    // Update engagement metrics
    profile.learningData.commonActions.push(action);
    profile.behaviorScore = Math.min(
      profile.behaviorScore + 0.01,
      1
    );

    // Track content type preference
    if (metadata.contentType) {
      const currentCount = profile.learningData.preferredContentTypes.filter(
        (c) => c === metadata.contentType
      ).length;
      profile.learningData.preferredContentTypes.push(metadata.contentType);
    }

    // Track time in sections
    if (metadata.section) {
      profile.learningData.timeSpentPerSection[metadata.section] =
        (profile.learningData.timeSpentPerSection[metadata.section] || 0) +
        (metadata.timeSpent || 1);
    }

    profile.lastUpdated = Date.now();
    this.saveProfile(profile);

    // Adapt experience based on behavior
    this.adaptExperience(profile);
  }

  /**
   * Update user preferences
   */
  updatePreferences(
    userId: string,
    preferences: Partial<UserProfile['preferences']>
  ): UserProfile {
    const profile = this.getOrCreateProfile(userId);
    profile.preferences = { ...profile.preferences, ...preferences };
    profile.lastUpdated = Date.now();
    this.saveProfile(profile);
    return profile;
  }

  /**
   * Adapt experience based on user behavior
   */
  private adaptExperience(profile: UserProfile): void {
    const engagementLevel =
      (profile.learningData.commonActions.length / 100) * 0.5 +
      profile.learningData.completionRate * 0.5;

    profile.learningData.engagementLevel = Math.min(engagementLevel, 1);

    // Auto-adjust content pace based on engagement
    if (engagementLevel > 0.8) {
      profile.preferences.contentPace = 'fast';
      profile.adaptations.suggestionsEnabled = true;
    } else if (engagementLevel < 0.3) {
      profile.preferences.contentPace = 'slow';
      profile.adaptations.suggestionsEnabled = true;
    }

    // Enable/disable animations based on patterns
    if (profile.learningData.commonActions.length > 50) {
      profile.adaptations.animationsEnabled = true;
    }

    this.saveProfile(profile);
  }

  /**
   * Get personalized recommendations
   */
  getPersonalizedContent(
    userId: string,
    contentOptions: Array<{ id: string; type: string; priority: number }>
  ): typeof contentOptions {
    const profile = this.getOrCreateProfile(userId);

    // Score content based on user preferences
    return contentOptions
      .map((content) => {
        let score = content.priority;

        // Boost if matches preferred content type
        if (profile.learningData.preferredContentTypes.includes(content.type)) {
          score += 0.3;
        }

        // Adjust based on engagement level
        if (profile.learningData.engagementLevel > 0.7) {
          score += 0.2;
        }

        return { ...content, score };
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5);
  }

  /**
   * Get adaptive UI configuration
   */
  getAdaptiveConfig(userId: string) {
    const profile = this.getOrCreateProfile(userId);

    return {
      showSuggestions: profile.adaptations.suggestionsEnabled,
      enableAnimations: profile.adaptations.animationsEnabled,
      contentPace: profile.preferences.contentPace,
      interactionStyle: profile.preferences.interactionStyle,
      theme: profile.preferences.theme,
      skipOptional: profile.preferences.skipOptional,
      notificationFrequency: profile.preferences.notificationFrequency,
      mobileOptimized:
        window.innerWidth < 768 ? true : profile.adaptations.mobileOptimized,
    };
  }

  /**
   * Update completion metrics
   */
  markSectionComplete(userId: string, section: string): void {
    const profile = this.getOrCreateProfile(userId);
    profile.learningData.completionRate = Math.min(
      profile.learningData.completionRate + 0.1,
      1
    );
    profile.lastUpdated = Date.now();
    this.saveProfile(profile);
  }

  /**
   * Get learning summary
   */
  getLearningMetrics(userId: string) {
    const profile = this.getOrCreateProfile(userId);

    return {
      engagementLevel: profile.learningData.engagementLevel,
      completionRate: profile.learningData.completionRate,
      totalInteractions: profile.learningData.commonActions.length,
      mostUsedFeatures: this.getMostFrequentActions(
        profile.learningData.commonActions,
        5
      ),
      timeSpentPerSection: profile.learningData.timeSpentPerSection,
      behaviorScore: profile.behaviorScore,
    };
  }

  /**
   * Get most frequent actions
   */
  private getMostFrequentActions(
    actions: string[],
    limit: number = 5
  ): Array<{ action: string; count: number }> {
    const counts: Record<string, number> = {};

    actions.forEach((action) => {
      counts[action] = (counts[action] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Save profile to localStorage
   */
  private saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save profile to localStorage:', e);
    }
  }

  /**
   * Get stored profile from localStorage
   */
  private getStoredProfile(): UserProfile | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Failed to read profile from localStorage:', e);
      return null;
    }
  }

  /**
   * Clear all personalizations
   */
  clearProfile(userId: string): void {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.sessionKey);
    } catch (e) {
      console.warn('Failed to clear profile:', e);
    }
  }

  /**
   * Export user data
   */
  exportUserData(userId: string): UserProfile | null {
    return this.getOrCreateProfile(userId);
  }
}

export const personalizationEngine = new PersonalizationEngine();

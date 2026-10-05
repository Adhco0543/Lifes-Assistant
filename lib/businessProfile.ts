/**
 * Business Profile System
 * Manages business type, configuration, and industry-specific settings
 */

export type BusinessType = 
  | 'carpentry'
  | 'plumbing'
  | 'electrical'
  | 'landscaping'
  | 'consulting'
  | 'retail'
  | 'restaurant'
  | 'cleaning'
  | 'hvac'
  | 'roofing'
  | 'painting'
  | 'other';

export interface BusinessProfile {
  userId: string;
  businessName: string;
  businessType: BusinessType;
  createdAt: number;
  updatedAt: number;
  details: {
    description: string;
    website?: string;
    phone?: string;
    email: string;
    serviceArea?: string;
    yearsInBusiness: number;
    employees: number;
    specialties: string[];
  };
  settings: {
    defaultHourlyRate?: number;
    defaultMarginPercentage?: number;
    currency: string;
    timezone: string;
    language: string;
  };
  capabilities: {
    estimating: boolean;
    materialCalculation: boolean;
    bidManagement: boolean;
    emailMarketing: boolean;
    jobTracking: boolean;
    clientNotes: boolean;
  };
  integrations: {
    emailProvider?: 'gmail' | 'outlook' | 'other';
    jobBoards?: string[];
    accountingSystem?: string;
  };
}

export interface BusinessContext {
  profile: BusinessProfile;
  activeProjects: string[];
  clientCount: number;
  averageProjectValue: number;
  successRate: number;
}

const PROFILE_KEY = "lifes_assistant_business_profile";
const ONBOARDING_FLAG_KEY = "onboarding_completed";

const profileKey = (userId: string) => `${PROFILE_KEY}:${userId}`;
const onboardingKey = (userId: string) => `${ONBOARDING_FLAG_KEY}:${userId}`;

export const businessProfileManager = {
  saveProfile(userId: string, profile: any) {
    localStorage.setItem(
      profileKey(userId),
      JSON.stringify({
        ...profile,
        userId,
        savedAt: Date.now(),
      })
    );
    localStorage.setItem(onboardingKey(userId), 'true');
  },

  loadProfile(userId: string) {
    let saved = localStorage.getItem(profileKey(userId));

    if (!saved) {
      const legacy = localStorage.getItem(PROFILE_KEY);
      if (legacy) {
        try {
          const legacyProfile = JSON.parse(legacy);
          if (legacyProfile?.userId === userId) {
            saved = legacy;
            localStorage.setItem(profileKey(userId), legacy);
          }
        } catch {
          // Ignore unreadable legacy data.
        }
      }
    }

    if (!saved) return null;

    try {
      const profile = JSON.parse(saved);
      // Verify the profile has required fields for onboarding to be considered complete
      if (profile.businessName && profile.businessType) {
        return profile;
      }
      return null;
    } catch {
      return null;
    }
  },

  isOnboardingComplete(userId = "default-user"): boolean {
    return localStorage.getItem(onboardingKey(userId)) === 'true';
  },

  updateProfile(userId: string, updates: any) {
    const existing = this.loadProfile(userId);
    const merged = { ...existing, ...updates };
    this.saveProfile(userId, merged);
  },

  createProfile(userId: string, businessName: string, businessType: string, email: string) {
    const profile: any = {
      userId,
      businessName,
      businessType,
      email,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      details: {
        description: '',
        email,
        yearsInBusiness: 0,
        employees: 1,
        specialties: [],
      },
      settings: {
        currency: 'USD',
        timezone: 'UTC',
        language: 'en',
      },
      capabilities: {
        estimating: true,
        materialCalculation: true,
        bidManagement: true,
        emailMarketing: true,
        jobTracking: true,
        clientNotes: true,
      },
      integrations: {
        jobBoards: [],
      },
    };
    this.saveProfile(userId, profile);
    return profile;
  },

  clearProfile(userId = "default-user") {
    localStorage.removeItem(profileKey(userId));
    localStorage.removeItem(onboardingKey(userId));
  },
};

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

class BusinessProfileManager {
  private storageKey = 'business_profile';

  /**
   * Create new business profile
   */
  createProfile(
    userId: string,
    businessName: string,
    businessType: BusinessType,
    email: string
  ): BusinessProfile {
    const profile: BusinessProfile = {
      userId,
      businessName,
      businessType,
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

    this.saveProfile(profile);
    return profile;
  }

  /**
   * Get or create business profile for user
   */
  getOrCreateProfile(userId: string): BusinessProfile | null {
    const stored = this.getStoredProfile();
    if (stored && stored.userId === userId) {
      return stored;
    }
    return null;
  }

  /**
   * Load existing profile
   */
  loadProfile(userId: string): BusinessProfile | null {
    const stored = this.getStoredProfile();
    if (stored && stored.userId === userId) {
      return stored;
    }
    return null;
  }

  /**
   * Update profile
   */
  updateProfile(userId: string, updates: Partial<BusinessProfile>): BusinessProfile {
    const profile = this.getStoredProfile();
    if (!profile || profile.userId !== userId) {
      throw new Error('Profile not found');
    }

    const updated: BusinessProfile = {
      ...profile,
      ...updates,
      userId,
      updatedAt: Date.now(),
    };

    this.saveProfile(updated);
    return updated;
  }

  /**
   * Update settings
   */
  updateSettings(userId: string, settings: Partial<BusinessProfile['settings']>): void {
    const profile = this.getStoredProfile();
    if (!profile || profile.userId !== userId) {
      throw new Error('Profile not found');
    }

    profile.settings = { ...profile.settings, ...settings };
    profile.updatedAt = Date.now();
    this.saveProfile(profile);
  }

  /**
   * Update business details
   */
  updateDetails(userId: string, details: Partial<BusinessProfile['details']>): void {
    const profile = this.getStoredProfile();
    if (!profile || profile.userId !== userId) {
      throw new Error('Profile not found');
    }

    profile.details = { ...profile.details, ...details };
    profile.updatedAt = Date.now();
    this.saveProfile(profile);
  }

  /**
   * Get business context with metrics
   */
  getBusinessContext(userId: string): BusinessContext | null {
    const profile = this.loadProfile(userId);
    if (!profile) return null;

    return {
      profile,
      activeProjects: [],
      clientCount: 0,
      averageProjectValue: profile.settings.defaultHourlyRate ? profile.settings.defaultHourlyRate * 8 : 0,
      successRate: 0.95,
    };
  }

  /**
   * Get business features based on type
   */
  getBusinessTypeFeatures(businessType: BusinessType): Record<string, boolean> {
    const baseFeatures = {
      estimating: true,
      materialCalculation: false,
      bidding: true,
      scheduling: true,
      clientTracking: true,
      marketing: true,
    };

    const typeSpecific: Record<BusinessType, Record<string, boolean>> = {
      carpentry: {
        ...baseFeatures,
        materialCalculation: true,
        woodworkingCalcs: true,
        cuttingLists: true,
      },
      plumbing: {
        ...baseFeatures,
        materialCalculation: true,
        pipeCalculations: true,
        partsList: true,
      },
      electrical: {
        ...baseFeatures,
        materialCalculation: true,
        wiringCalcs: true,
        loadCalculations: true,
      },
      landscaping: {
        ...baseFeatures,
        materialCalculation: true,
        areaCalculations: true,
        plantingPlans: true,
      },
      consulting: {
        ...baseFeatures,
        materialCalculation: false,
        reportGeneration: true,
        strategyPlanning: true,
      },
      retail: {
        ...baseFeatures,
        materialCalculation: false,
        inventory: true,
        salesTracking: true,
      },
      restaurant: {
        ...baseFeatures,
        materialCalculation: false,
        menuPlanning: true,
        inventoryTracking: true,
      },
      cleaning: {
        ...baseFeatures,
        materialCalculation: true,
        supplyEstimation: true,
        scheduleOptimization: true,
      },
      hvac: {
        ...baseFeatures,
        materialCalculation: true,
        loadCalculations: true,
        efficencyAnalysis: true,
      },
      roofing: {
        ...baseFeatures,
        materialCalculation: true,
        squareCalculations: true,
        slopeCalculations: true,
      },
      painting: {
        ...baseFeatures,
        materialCalculation: true,
        coverageCalculations: true,
        paintEstimates: true,
      },
      other: baseFeatures,
    };

    return typeSpecific[businessType] || baseFeatures;
  }

  /**
   * Get recommended tools for business type
   */
  getRecommendedTools(businessType: BusinessType): string[] {
    const toolMap: Record<BusinessType, string[]> = {
      carpentry: ['QuoteBuilder', 'MaterialEstimator', 'ProjectTracker', 'ClientManager'],
      plumbing: ['QuoteBuilder', 'MaterialEstimator', 'ServiceScheduler', 'ClientManager'],
      electrical: ['QuoteBuilder', 'LoadCalculator', 'ProjectTracker', 'SafetyChecker'],
      landscaping: ['DesignTool', 'MaterialEstimator', 'ProjectVisualizer', 'ClientGallery'],
      consulting: ['ProposalBuilder', 'DocumentGenerator', 'ContractManager', 'ClientTracker'],
      retail: ['InventoryManager', 'PricingTool', 'SalesTracker', 'CustomerAnalytics'],
      restaurant: ['MenuPlanner', 'InventoryManager', 'StaffScheduler', 'OrderManager'],
      cleaning: ['JobScheduler', 'SupplyEstimator', 'ClientTracker', 'RoutePlanner'],
      hvac: ['LoadCalculator', 'SystemDesigner', 'MaintenanceTracker', 'ClientManager'],
      roofing: ['MeasurementTool', 'MaterialCalculator', 'InspectionReporter', 'ClientGallery'],
      painting: ['ColorSelector', 'CoverageCalculator', 'ProjectTracker', 'BeforeAfterShowcase'],
      other: ['BasicQuoteBuilder', 'ClientManager', 'DocumentStorage', 'TaskTracker'],
    };

    return toolMap[businessType] || toolMap.other;
  }

  /**
   * Save profile to localStorage
   */
  private saveProfile(profile: BusinessProfile): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to save business profile:', e);
    }
  }

  /**
   * Get stored profile from localStorage
   */
  private getStoredProfile(): BusinessProfile | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Failed to read business profile:', e);
      return null;
    }
  }

  /**
   * Export profile data
   */
  exportProfile(userId: string): BusinessProfile | null {
    return this.loadProfile(userId);
  }

  /**
   * Clear profile
   */
  clearProfile(userId: string): void {
    const profile = this.getStoredProfile();
    if (profile && profile.userId === userId) {
      localStorage.removeItem(this.storageKey);
    }
  }
}

export const businessProfileManager = new BusinessProfileManager();

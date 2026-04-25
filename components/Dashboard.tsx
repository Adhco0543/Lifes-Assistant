'use client';

import React, { useState, useEffect } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { businessProfileManager, BusinessProfile } from '../lib/businessProfile';
import { analyticsTracker, EngagementMetrics } from '../lib/analytics';
import { RichMedia } from './Richmedia';
import { DashboardCommandCenter } from './DashboardCommandCenter';
import { BusinessRecommendations } from './BusinessRecommendations';

interface DashboardProps {
  userId: string;
  businessType?: string;
  onViewChange?: (view: 'dashboard' | 'chat' | 'quotes' | 'notes' | 'email' | 'materials' | 'onboarding' | 'settings' | 'tasks' | 'team' | 'recommendations' | 'customization') => void;
}

interface DashboardMetrics {
  quotesGenerated: number;
  notesCreated: number;
  activeProjects: number;
  clientsContacted: number;
  engagementMetrics: EngagementMetrics | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ userId, businessType = 'business', onViewChange }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    quotesGenerated: 0,
    notesCreated: 0,
    activeProjects: 0,
    clientsContacted: 0,
    engagementMetrics: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const handleActionSelect = (action: string) => {
    if (onViewChange) {
      onViewChange(action as any);
    }
  };

  // Initialize on mount
  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);

      try {
        const profile = businessProfileManager.loadProfile(userId);
        if (profile) {
          setBusinessProfile(profile);
        }

        const engagementMetrics = analyticsTracker.getEngagementMetrics(userId);
        setMetrics(prev => ({
          ...prev,
          engagementMetrics,
        }));

        integration.trackUserAction('dashboard_view', 'dashboard', {
          businessType: profile?.businessType,
        });
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [userId, integration]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#999', textAlign: 'center' }}>
        <RichMedia type="animation" animation="pulse" size="lg" />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  if (!businessProfile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#999', textAlign: 'center' }}>
        <RichMedia type="visual" size="xl" />
        <h2>Setup your business profile first</h2>
        <p>Complete onboarding to see your dashboard</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', margin: '0 0 0.5rem 0' }}>Welcome back, {businessProfile.businessName}!</h1>
        <p style={{ fontSize: '1rem', color: '#6b7280', margin: 0 }}>{businessProfile.businessType}</p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem' }}>
        {/* Command Center */}
        <div>
          <DashboardCommandCenter userId={userId} onActionSelect={handleActionSelect} />
        </div>

        {/* Recommendations & Tools */}
        <div>
          <BusinessRecommendations businessType={businessProfile.businessType || businessType} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

'use client';

import React, { useState, useEffect } from 'react';
import { useResponsive } from '../lib/hooks';
import { businessProfileManager } from '../lib/businessProfile';
import { HeroBackground, PageWrapper, CollaborationIndicator } from './BackgroundVisuals';
import { MetricCard, SummaryCard, ProgressCard, PerformanceCard } from './InsightCards';
import { SuggestionsWidget } from './SuggestionsWidget';
import { RichMedia } from './Richmedia';

interface EnhancedDashboardProps {
  userId: string;
  themeColors?: {
    background: string;
    text: string;
    textSecondary: string;
    surface: string;
    border: string;
    primary: string;
  };
}

export const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({ 
  userId,
  themeColors = {
    background: '#f8f9fa',
    text: '#000',
    textSecondary: '#666',
    surface: '#fff',
    border: '#f0f0f0',
    primary: '#667eea'
  }
}) => {
  const { isMobile } = useResponsive();
  const [businessProfile, setBusinessProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const profile = businessProfileManager.loadProfile(userId);
      if (profile) {
        setBusinessProfile(profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  if (isLoading) {
    return (
      <div style={styles.loadingContainer}>
        <RichMedia type="animation" animation="spin" size="lg" />
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // Sample data - in real app would come from analytics
  const metrics = {
    quotesThisMonth: 7,
    quotesLastMonth: 5,
    revenue: 15400,
    revenueLastMonth: 12100,
    activeClients: 8,
    completedProjects: 12,
  };

  const teamMembers = [
    { name: 'You', color: '#667eea' },
    { name: 'John', color: '#f093fb' },
    { name: 'Sarah', color: '#4ecdc4' },
  ];

  return (
    <div style={{ ...styles.wrapper, backgroundColor: themeColors.background }}>
      {/* Hero Section */}
      <HeroBackground theme="professional" height="350px">
        <div style={styles.heroContent}>
          <h1 style={styles.heroTitle}>
            Welcome back, {businessProfile?.businessName || 'Business Owner'}! 👋
          </h1>
          <p style={styles.heroSubtitle}>
            Let's make today productive. Here's your performance snapshot.
          </p>
        </div>
      </HeroBackground>

      {/* Main Content */}
      <div style={styles.contentContainer}>
        {/* Top Quick Stats */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>📊 Performance Overview</h2>
            <span style={styles.dateRange}>This Month</span>
          </div>

          <div style={styles.metricsGrid}>
            <MetricCard
              title="Quotes Created"
              value={metrics.quotesThisMonth}
              change={{
                percent: 40,
                trend: 'up',
              }}
              icon="📄"
              description="Strong activity this month"
              color="#667eea"
            />

            <MetricCard
              title="Revenue Generated"
              value={`$${metrics.revenue.toLocaleString()}`}
              change={{
                percent: 27,
                trend: 'up',
              }}
              icon="💰"
              description="Growing revenue stream"
              color="#11998e"
            />

            <MetricCard
              title="Active Clients"
              value={metrics.activeClients}
              change={{
                percent: 12,
                trend: 'up',
              }}
              icon="👥"
              description="Client base expanding"
              color="#f093fb"
            />

            <MetricCard
              title="Projects Completed"
              value={metrics.completedProjects}
              change={{
                percent: 8,
                trend: 'stable',
              }}
              icon="✅"
              description="Consistent delivery"
              color="#FFB84D"
            />
          </div>
        </div>

        {/* Collaboration Section */}
        {teamMembers.length > 1 && (
          <div style={styles.section}>
            <CollaborationIndicator teamMembers={teamMembers} />
          </div>
        )}

        {/* AI Suggestions */}
        <div style={styles.section}>
          <SuggestionsWidget
            userId={userId}
            businessType={businessProfile?.businessType || 'general'}
            onActionClick={(type) => {
              // Handle action
              console.log('Action clicked:', type);
            }}
          />
        </div>

        {/* Progress & Goals */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>🎯 Monthly Goals</h2>
          </div>

          <div style={styles.gridTwo}>
            <ProgressCard
              title="Quote Target"
              current={metrics.quotesThisMonth}
              target={12}
              unit="quotes"
            />

            <ProgressCard
              title="Revenue Target"
              current={Math.round(metrics.revenue / 1000)}
              target={20}
              unit="k"
            />
          </div>
        </div>

        {/* Performance Comparison */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>📈 Industry Benchmarks</h2>
          </div>

          <div style={styles.gridTwo}>
            <PerformanceCard
              metric="Quote Volume"
              yourValue={metrics.quotesThisMonth}
              benchmark={10}
              unit="per month"
              aboveTarget={metrics.quotesThisMonth >= 10}
            />

            <PerformanceCard
              metric="Avg Quote Value"
              yourValue={Math.round(metrics.revenue / metrics.quotesThisMonth)}
              benchmark={1800}
              unit="$"
              aboveTarget={
                Math.round(metrics.revenue / metrics.quotesThisMonth) >= 1800
              }
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div style={styles.section}>
          <div style={styles.gridTwo}>
            <SummaryCard
              title="Team Activity"
              icon="🚀"
              stats={[
                { label: 'Team Size', value: teamMembers.length },
                { label: 'Active Today', value: '3' },
                { label: 'Tasks Completed', value: '24' },
              ]}
              cta={{
                text: 'Manage Team',
                onClick: () => console.log('Manage team'),
              }}
            />

            <SummaryCard
              title="Recent Highlights"
              icon="⭐"
              stats={[
                { label: 'Largest Deal', value: '$3,200' },
                { label: 'Fastest Quote', value: '2 hours' },
                { label: 'Client Satisfaction', value: '4.8/5' },
              ]}
              cta={{
                text: 'View Details',
                onClick: () => console.log('View details'),
              }}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>⚡ Quick Actions</h2>
          </div>

          <div style={styles.actionGrid}>
            {[
              {
                icon: '📝',
                title: 'Create Quote',
                description: 'Generate a new quote',
              },
              {
                icon: '📧',
                title: 'Send Email',
                description: 'Contact your clients',
              },
              {
                icon: '📋',
                title: 'Add Note',
                description: 'Document your projects',
              },
              {
                icon: '📊',
                title: 'View Reports',
                description: 'See your analytics',
              },
            ].map((action, idx) => (
              <button
                key={idx}
                style={{
                  ...styles.actionButton,
                  backgroundColor: themeColors.surface,
                  color: themeColors.text,
                  borderColor: themeColors.border,
                }}
              >
                <span style={styles.actionIcon}>{action.icon}</span>
                <div style={styles.actionText}>
                  <h4 style={{ ...styles.actionTitle, color: themeColors.text }}>
                    {action.title}
                  </h4>
                  <p
                    style={{
                      ...styles.actionDesc,
                      color: themeColors.textSecondary,
                    }}
                  >
                    {action.description}
                  </p>
                </div>
                <span style={{ ...styles.actionArrow, color: themeColors.primary }}>
                  →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        ${getDashboardStyles()}
      `}</style>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#f8f9fa',
  },
  loadingContainer: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: '100vh',
    gap: '1rem',
  },
  heroContent: {
    color: 'white',
    textAlign: 'center' as const,
    maxWidth: '600px',
  },
  heroTitle: {
    margin: 0,
    fontSize: '2.5rem',
    fontWeight: 'bold' as const,
    textShadow: '0 2px 10px rgba(0,0,0,0.2)',
  },
  heroSubtitle: {
    margin: '1rem 0 0 0',
    fontSize: '1.1rem',
    opacity: 0.95,
    textShadow: '0 1px 5px rgba(0,0,0,0.1)',
  },
  contentContainer: {
    maxWidth: '1200px',
    margin: '-60px auto 0',
    padding: '0 1.5rem 2rem',
    position: 'relative' as const,
    zIndex: 10,
  },
  section: {
    marginBottom: '2rem',
  },
  sectionHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
  },
  dateRange: {
    fontSize: '0.9rem',
    color: '#999',
  },
  metricsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
  },
  gridTwo: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  actionGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1rem',
  },
  actionButton: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '1rem',
    padding: '1.25rem',
    backgroundColor: 'white',
    border: '2px solid #f0f0f0',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  actionIcon: {
    fontSize: '2rem',
  },
  actionText: {
    flex: 1,
    textAlign: 'left' as const,
  },
  actionTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'bold' as const,
  },
  actionDesc: {
    margin: '0.25rem 0 0 0',
    fontSize: '0.85rem',
    color: '#999',
  },
  actionArrow: {
    fontSize: '1.5rem',
    color: '#667eea',
  },
};

function getDashboardStyles() {
  return `
    button:hover { 
      border-color: #667eea; 
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }
    
    h1, h2, h3, h4 { color: #000; }
    p { color: #666; }
  `;
}

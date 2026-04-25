'use client';

import React, { useState } from 'react';
import { AnimatedQuotePreview } from './AnimatedQuotePreview';
import { SuggestionsWidget } from './SuggestionsWidget';
import { MetricCard, ProgressCard } from './InsightCards';
import { HeroBackground, CollaborationIndicator } from './BackgroundVisuals';

export const WOWShowcase: React.FC = () => {
  const [showQuote, setShowQuote] = useState(false);

  const teamMembers = [
    { name: 'You', color: '#667eea' },
    { name: 'John', color: '#f093fb' },
    { name: 'Sarah', color: '#4ecdc4' },
  ];

  return (
    <div style={styles.wrapper}>
      {/* Hero Banner */}
      <HeroBackground theme="success" height="400px">
        <div style={styles.heroContent}>
          <h1 style={styles.title}>✨ Your AI-Powered Business Assistant</h1>
          <p style={styles.subtitle}>
            Experience the future of business management with smart visualizations, ai suggestions, and beautiful interactions
          </p>
        </div>
      </HeroBackground>

      {/* Main Content */}
      <div style={styles.contentContainer}>
        {/* Features Grid */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🎯 Intelligent Features</h2>

          <div style={styles.gridThree}>
            {[
              {
                icon: '🤖',
                title: 'AI Suggestions',
                description: 'Smart recommendations based on your business activity and industry benchmarks',
              },
              {
                icon: '📊',
                title: 'Beautiful Analytics',
                description: 'Professional metric cards showing trends, progress, and performance data',
              },
              {
                icon: '✨',
                title: 'Stunning Visuals',
                description: 'Animated backgrounds, smooth transitions, and polished design system',
              },
            ].map((feature, idx) => (
              <div key={idx} style={styles.featureCard}>
                <div style={styles.featureIcon}>{feature.icon}</div>
                <h3 style={styles.featureTitle}>{feature.title}</h3>
                <p style={styles.featureDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live Metric Cards */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📈 Performance Metrics</h2>

          <div style={styles.gridTwo}>
            <MetricCard
              title="Revenue This Month"
              value="$15,400"
              change={{ percent: 27, trend: 'up' }}
              icon="💰"
              description="27% increase from last month"
              color="#11998e"
            />

            <MetricCard
              title="Quotes Generated"
              value="7"
              change={{ percent: 40, trend: 'up' }}
              icon="📄"
              description="40% more quotes created"
              color="#667eea"
            />
          </div>

          <div style={styles.gridTwo}>
            <ProgressCard
              title="Monthly Revenue Target"
              current={15.4}
              target={20}
              unit="k"
            />

            <ProgressCard
              title="Quote Generation Goal"
              current={7}
              target={12}
              unit="quotes"
            />
          </div>
        </section>

        {/* AI Suggestions */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🤖 AI-Powered Suggestions</h2>
          <p style={styles.sectionSubtitle}>
            Watch as your AI assistant analyzes your activity and recommends next actions
          </p>
          <SuggestionsWidget
            userId="demo"
            businessType="general"
            onActionClick={(type) => console.log('Action:', type)}
          />
        </section>

        {/* Animated Quote Preview */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>🎬 Watch Quotes Come to Life</h2>
          <p style={styles.sectionSubtitle}>
            See how quotes are generated dynamically with smooth animations
          </p>

          {!showQuote ? (
            <button
              onClick={() => setShowQuote(true)}
              style={styles.triggerButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow =
                  '0 8px 24px rgba(102, 126, 234, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 4px 12px rgba(102, 126, 234, 0.2)';
              }}
            >
              ▶️ Start Quote Animation
            </button>
          ) : (
            <AnimatedQuotePreview
              title="Website Redesign Project"
              clientName="Acme Corp"
              quoteItems={[
                {
                  description: 'UX/UI Design',
                  quantity: 1,
                  unitPrice: 3000,
                  subtotal: 3000,
                },
                {
                  description: 'Frontend Development',
                  quantity: 120,
                  unitPrice: 85,
                  subtotal: 10200,
                },
                {
                  description: 'Backend Integration',
                  quantity: 60,
                  unitPrice: 95,
                  subtotal: 5700,
                },
                {
                  description: 'Testing & QA',
                  quantity: 40,
                  unitPrice: 75,
                  subtotal: 3000,
                },
                {
                  description: 'Deployment & Support',
                  quantity: 1,
                  unitPrice: 2000,
                  subtotal: 2000,
                },
              ]}
              onComplete={() => {
                console.log('Quote completed!');
              }}
            />
          )}

          {showQuote && (
            <button
              onClick={() => setShowQuote(false)}
              style={styles.resetButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              ↻ Replay Animation
            </button>
          )}
        </section>

        {/* Team Collaboration */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>👥 Team Collaboration</h2>
          <CollaborationIndicator teamMembers={teamMembers} />
        </section>

        {/* CTA Section */}
        <section style={styles.ctaSection}>
          <h2 style={styles.ctaTitle}>Ready to Transform Your Business?</h2>
          <p style={styles.ctaText}>
            Start using AI-powered features today and watch your productivity soar
          </p>
          <button style={styles.ctaButton}>
            🚀 Get Started Now
          </button>
        </section>
      </div>
    </div>
  );
};

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#f8f9fa',
  },
  heroContent: {
    color: 'white',
    textAlign: 'center' as const,
    maxWidth: '700px',
  },
  title: {
    margin: 0,
    fontSize: '3rem',
    fontWeight: 'bold' as const,
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
  },
  subtitle: {
    margin: '1rem 0 0 0',
    fontSize: '1.2rem',
    opacity: 0.95,
    textShadow: '0 1px 5px rgba(0, 0, 0, 0.1)',
  },
  contentContainer: {
    maxWidth: '1200px',
    margin: '-80px auto 0',
    padding: '0 1.5rem 3rem',
    position: 'relative' as const,
    zIndex: 10,
  },
  section: {
    marginBottom: '3rem',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    marginBottom: '0.5rem',
  },
  sectionSubtitle: {
    margin: '0 0 1.5rem 0',
    color: '#666',
    fontSize: '1rem',
  },
  gridThree: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
  },
  gridTwo: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1.5rem',
  },
  featureCard: {
    background: 'white',
    padding: '2rem',
    borderRadius: '1rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    textAlign: 'center' as const,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  featureIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  featureTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: 'bold' as const,
    marginBottom: '0.5rem',
  },
  featureDesc: {
    margin: 0,
    color: '#666',
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
  triggerButton: {
    padding: '1rem 2rem',
    fontSize: '1rem',
    fontWeight: 'bold' as const,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)',
  },
  resetButton: {
    marginTop: '1rem',
    padding: '0.75rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: 500,
    background: 'transparent',
    color: '#667eea',
    border: '2px solid #667eea',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  ctaSection: {
    marginTop: '4rem',
    padding: '3rem 2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '1rem',
    textAlign: 'center' as const,
    color: 'white',
  },
  ctaTitle: {
    margin: 0,
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    marginBottom: '1rem',
  },
  ctaText: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.1rem',
    opacity: 0.95,
  },
  ctaButton: {
    padding: '1rem 2rem',
    fontSize: '1.1rem',
    fontWeight: 'bold' as const,
    background: 'white',
    color: '#667eea',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
};

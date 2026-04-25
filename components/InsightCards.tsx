'use client';

import React from 'react';
import { RichMedia } from './Richmedia';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    percent: number;
    trend: 'up' | 'down' | 'stable';
  };
  icon: string;
  description?: string;
  color?: string;
  animated?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon,
  description,
  color = '#667eea',
  animated = true,
}) => {
  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return '↗';
    if (trend === 'down') return '↘';
    return '→';
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'up') return '#4CAF50';
    if (trend === 'down') return '#F44336';
    return '#FFC107';
  };

  return (
    <div
      style={{
        ...styles.card,
        animation: animated ? 'slideUp 0.6s ease-out' : 'none',
      }}
    >
      <div style={styles.cardHeader}>
        <div
          style={{
            ...styles.iconBg,
            backgroundColor: `${color}20`,
            borderLeft: `4px solid ${color}`,
          }}
        >
          <div style={{ fontSize: '1.5rem' }}>{icon}</div>
        </div>
        {change && (
          <div
            style={{
              ...styles.changeLabel,
              color: getTrendColor(change.trend),
            }}
          >
            <span>{getTrendIcon(change.trend)}</span>
            <span>{Math.abs(change.percent)}%</span>
          </div>
        )}
      </div>

      <div style={styles.cardContent}>
        <p style={styles.cardTitle}>{title}</p>
        <div style={styles.cardValue}>{value}</div>
        {description && <p style={styles.cardDescription}>{description}</p>}
      </div>

      <div
        style={{
          ...styles.cardFooter,
          backgroundColor: `${color}10`,
        }}
      >
        <span style={{ fontSize: '0.85rem', color: color }}>View Details</span>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Summary card showing key insights
 */
export const SummaryCard: React.FC<{
  title: string;
  stats: Array<{ label: string; value: string | number }>;
  cta?: { text: string; onClick: () => void };
  icon?: string;
}> = ({ title, stats, cta, icon }) => {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryHeader}>
        {icon && <span style={{ fontSize: '1.75rem', marginRight: '0.75rem' }}>{icon}</span>}
        <div>
          <h3 style={styles.summaryTitle}>{title}</h3>
        </div>
      </div>

      <div style={styles.statsList}>
        {stats.map((stat, idx) => (
          <div key={idx} style={styles.statRow}>
            <span style={styles.statLabel}>{stat.label}</span>
            <span style={styles.statValue}>{stat.value}</span>
          </div>
        ))}
      </div>

      {cta && (
        <button onClick={cta.onClick} style={styles.ctaButton}>
          {cta.text} →
        </button>
      )}
    </div>
  );
};

/**
 * Animated progress card
 */
export const ProgressCard: React.FC<{
  title: string;
  current: number;
  target: number;
  unit?: string;
}> = ({ title, current, target, unit = '' }) => {
  const percentage = Math.min((current / target) * 100, 100);

  return (
    <div style={styles.progressCard}>
      <div style={styles.progressHeader}>
        <h4 style={styles.progressTitle}>{title}</h4>
        <span style={styles.progressValue}>
          {current} / {target} {unit}
        </span>
      </div>

      <div style={styles.progressBarBg}>
        <div
          style={{
            ...styles.progressBar,
            width: `${percentage}%`,
            animation: `expandWidth 1s ease-out`,
          }}
        />
      </div>

      <p style={styles.progressSubtext}>
        {Math.round(percentage)}% complete
      </p>

      <style jsx>{`
        @keyframes expandWidth {
          from {
            width: 0%;
          }
          to {
            width: ${percentage}%;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Performance comparison card
 */
export const PerformanceCard: React.FC<{
  metric: string;
  yourValue: number;
  benchmark: number;
  unit: string;
  aboveTarget: boolean;
}> = ({ metric, yourValue, benchmark, unit, aboveTarget }) => {
  const diff = ((yourValue - benchmark) / benchmark) * 100;

  return (
    <div style={styles.performanceCard}>
      <div style={styles.performanceHeader}>
        <h4>{metric}</h4>
        <div
          style={{
            ...styles.performanceBadge,
            backgroundColor: aboveTarget ? '#d4edda' : '#fff3cd',
            color: aboveTarget ? '#155724' : '#856404',
          }}
        >
          {aboveTarget ? '⬆ Above' : '⬇ Below'} Benchmark
        </div>
      </div>

      <div style={styles.performanceComparison}>
        <div style={styles.comparisonBox}>
          <p style={styles.comparisonLabel}>Your Performance</p>
          <p style={styles.comparisonNumber}>
            {yourValue} {unit}
          </p>
        </div>

        <div style={styles.comparisonBox}>
          <p style={styles.comparisonLabel}>Industry Benchmark</p>
          <p style={styles.comparisonNumber}>
            {benchmark} {unit}
          </p>
        </div>
      </div>

      <div
        style={{
          ...styles.diffLabel,
          color: aboveTarget ? '#4CAF50' : '#F44336',
        }}
      >
        {aboveTarget ? '+' : ''}{diff.toFixed(1)}% {aboveTarget ? 'ahead' : 'behind'}
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    '&:hover': {
      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.12)',
      transform: 'translateY(-4px)',
    },
  },
  cardHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: '1rem',
  },
  iconBg: {
    width: '50px',
    height: '50px',
    borderRadius: '0.75rem',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  changeLabel: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.35rem',
    fontSize: '0.9rem',
    fontWeight: 'bold' as const,
  },
  cardContent: {
    marginBottom: '1rem',
  },
  cardTitle: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#999',
    fontWeight: '500' as const,
  },
  cardValue: {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    margin: '0.5rem 0',
    color: '#000',
  },
  cardDescription: {
    margin: '0.5rem 0 0 0',
    fontSize: '0.85rem',
    color: '#666',
  },
  cardFooter: {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
  },
  summaryHeader: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    marginBottom: '1.5rem',
  },
  summaryTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
  },
  statsList: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  statRow: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingBottom: '1rem',
    borderBottom: '1px solid #f0f0f0',
  },
  statLabel: {
    fontSize: '0.95rem',
    color: '#666',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
    color: '#000',
  },
  ctaButton: {
    width: '100%',
    padding: '0.75rem',
    marginTop: '1rem',
    backgroundColor: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  progressCard: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
  },
  progressHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    marginBottom: '1rem',
  },
  progressTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'bold' as const,
  },
  progressValue: {
    fontSize: '0.9rem',
    color: '#666',
  },
  progressBarBg: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '9999px',
    overflow: 'hidden' as const,
    marginBottom: '0.5rem',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '9999px',
  },
  progressSubtext: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#999',
  },
  performanceCard: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
  },
  performanceHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '1.5rem',
  },
  performanceBadge: {
    padding: '0.4rem 0.8rem',
    borderRadius: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: 'bold' as const,
  },
  performanceComparison: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginBottom: '1rem',
  },
  comparisonBox: {
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.75rem',
    textAlign: 'center' as const,
  },
  comparisonLabel: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  comparisonNumber: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
  },
  diffLabel: {
    fontSize: '0.95rem',
    fontWeight: 'bold' as const,
    textAlign: 'center' as const,
  },
};

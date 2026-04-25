'use client';

import React, { useState, useEffect } from 'react';
import { aiSuggestionsEngine, Suggestion } from '../lib/aiSuggestions';
import { RichMedia } from './Richmedia';

interface SuggestionsWidgetProps {
  userId: string;
  businessType: string;
  onActionClick?: (type: string) => void;
}

export const SuggestionsWidget: React.FC<SuggestionsWidgetProps> = ({
  userId,
  businessType,
  onActionClick,
}) => {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    // Generate suggestions based on user data
    const userData = {
      quotesThisMonth: Math.floor(Math.random() * 8) + 2,
      notesCreated: Math.floor(Math.random() * 5),
      averageQuoteValue: 1500 + Math.random() * 1000,
      clientsContacted: Math.floor(Math.random() * 10) + 3,
      lastQuoteDate: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
      businessType,
      teamSize: Math.floor(Math.random() * 5),
      hasTeamMembers: Math.random() > 0.5,
    };

    const generated = aiSuggestionsEngine.generateSuggestions(userData);
    setSuggestions(generated);
  }, [businessType]);

  const handleDismiss = (id: string) => {
    aiSuggestionsEngine.dismissSuggestion(id);
    setSuggestions(suggestions.filter((s) => s.id !== id));
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: '#F44336',
      high: '#FF9800',
      medium: '#FFC107',
      low: '#4CAF50',
    };
    return colors[priority] || '#2196F3';
  };

  const getPriorityBgColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: '#FFEBEE',
      high: '#FFF3E0',
      medium: '#FFFDE7',
      low: '#E8F5E9',
    };
    return colors[priority] || '#E3F2FD';
  };

  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, 3);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>
          <span style={styles.sparkle}>✨</span> AI Suggestions
        </h3>
        <span style={styles.badge}>{suggestions.length} new</span>
      </div>

      <div style={styles.suggestionsStack}>
        {visibleSuggestions.map((suggestion, idx) => (
          <div
            key={suggestion.id}
            style={{
              ...styles.suggestionCard,
              backgroundColor: getPriorityBgColor(suggestion.priority),
              borderLeft: `4px solid ${getPriorityColor(suggestion.priority)}`,
              animation: `slideIn 0.3s ease-out ${idx * 0.1}s both`,
            }}
          >
            <div style={styles.suggestionHeader}>
              <div style={styles.titleSection}>
                <h4 style={styles.suggestionTitle}>{suggestion.title}</h4>
                <span
                  style={{
                    ...styles.priorityLabel,
                    color: getPriorityColor(suggestion.priority),
                  }}
                >
                  {suggestion.priority}
                </span>
              </div>
              <button
                onClick={() => handleDismiss(suggestion.id)}
                style={styles.dismissBtn}
                title="Dismiss"
              >
                ✕
              </button>
            </div>

            <p style={styles.description}>{suggestion.description}</p>

            {suggestion.actionText && (
              <button
                onClick={() => onActionClick?.(suggestion.type)}
                style={{
                  ...styles.actionButton,
                  backgroundColor: getPriorityColor(suggestion.priority),
                }}
              >
                {suggestion.actionText} →
              </button>
            )}
          </div>
        ))}
      </div>

      {!showAll && suggestions.length > 3 && (
        <button
          onClick={() => setShowAll(true)}
          style={styles.showMoreButton}
        >
          Show {suggestions.length - 3} more suggestions
        </button>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    marginBottom: '2rem',
  },
  header: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: '1rem',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 'bold' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.5rem',
  },
  sparkle: {
    fontSize: '1.5rem',
    animation: 'pulse 2s infinite',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#FF6B6B',
    color: 'white',
    padding: '0.35rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.85rem',
    fontWeight: 'bold' as const,
  },
  suggestionsStack: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '1rem',
  },
  suggestionCard: {
    padding: '1.25rem',
    borderRadius: '0.75rem',
    transition: 'all 0.3s ease',
    cursor: 'pointer' as const,
    '&:hover': {
      transform: 'translateX(4px)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },
  },
  suggestionHeader: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: '0.75rem',
  },
  titleSection: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.75rem',
  },
  suggestionTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 'bold' as const,
  },
  priorityLabel: {
    fontSize: '0.75rem',
    fontWeight: 'bold' as const,
    textTransform: 'uppercase' as const,
  },
  dismissBtn: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: 0,
    '&:hover': {
      color: '#F44336',
    },
  },
  description: {
    margin: '0.75rem 0',
    fontSize: '0.95rem',
    color: '#555',
  },
  actionButton: {
    display: 'inline-block',
    marginTop: '0.75rem',
    padding: '0.6rem 1.2rem',
    backgroundColor: '#007BFF',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.9rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    },
  },
  showMoreButton: {
    width: '100%',
    padding: '1rem',
    marginTop: '1rem',
    backgroundColor: '#f0f0f0',
    border: '2px solid #e0e0e0',
    borderRadius: '0.5rem',
    fontSize: '0.95rem',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      backgroundColor: '#e8e8e8',
    },
  },
};

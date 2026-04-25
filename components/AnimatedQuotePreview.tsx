'use client';

import React, { useState, useEffect } from 'react';

interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface AnimatedQuotePreviewProps {
  title?: string;
  clientName?: string;
  quoteItems?: QuoteItem[];
  onComplete?: () => void;
  animationDuration?: number;
}

export const AnimatedQuotePreview: React.FC<AnimatedQuotePreviewProps> = ({
  title = 'Project Quote',
  clientName = 'Client Name',
  quoteItems = [
    { description: 'Web Design Services', quantity: 1, unitPrice: 2500, subtotal: 2500 },
    { description: 'Development Hours', quantity: 80, unitPrice: 75, subtotal: 6000 },
    { description: 'Hosting & Deployment', quantity: 12, unitPrice: 100, subtotal: 1200 },
  ],
  onComplete,
  animationDuration = 50,
}) => {
  const [visibleItems, setVisibleItems] = useState(0);
  const [animatingCharIndex, setAnimatingCharIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (completed && onComplete) {
      onComplete();
    }
  }, [completed, onComplete]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (visibleItems < quoteItems.length) {
      timer = setTimeout(() => {
        setVisibleItems((prev) => prev + 1);
      }, animationDuration * 20);
    } else if (visibleItems === quoteItems.length && !completed) {
      timer = setTimeout(() => {
        setCompleted(true);
      }, animationDuration * 10);
    }

    return () => clearTimeout(timer);
  }, [visibleItems, quoteItems.length, completed, animationDuration]);

  const total = quoteItems.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes fadeInUp {
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
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .quote-item {
          animation: slideInLeft 0.6s ease-out forwards;
        }

        .quote-total {
          animation: fadeInUp 0.8s ease-out forwards;
        }

        .quote-loading {
          animation: pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div style={styles.quoteContainer}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>📄 {title}</h2>
          <p style={styles.client}>For: {clientName}</p>
        </div>

        {/* Items */}
        <div style={styles.itemsContainer}>
          {quoteItems.map((item, idx) => (
            visibleItems > idx && (
              <div
                key={idx}
                style={{
                  ...styles.quoteItem,
                  animationDelay: `${idx * 0.15}s`,
                  opacity: visibleItems > idx ? 1 : 0,
                }}
                className="quote-item"
              >
                <div style={styles.itemLeft}>
                  <div style={styles.itemDescription}>{item.description}</div>
                  <div style={styles.itemDetails}>
                    {item.quantity} × ${item.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div style={styles.itemRight}>
                  ${item.subtotal.toFixed(2)}
                </div>
              </div>
            )
          ))}

          {/* Loading indicator */}
          {visibleItems < quoteItems.length && (
            <div style={styles.loadingItem} className="quote-loading">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={styles.loadingDot}></div>
                <div style={styles.loadingDot}></div>
                <div style={styles.loadingDot}></div>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        {visibleItems > 0 && <div style={styles.divider}></div>}

        {/* Total */}
        {visibleItems === quoteItems.length && (
          <div style={styles.totalContainer} className="quote-total">
            <div style={styles.totalLabel}>Total Amount</div>
            <div style={styles.totalAmount}>${total.toFixed(2)}</div>
            <div style={styles.totalNote}>Quote valid for 30 days</div>
          </div>
        )}

        {/* Action hint */}
        {completed && (
          <div style={styles.actionHint} className="quote-total">
            ✨ Quote generated successfully! Ready to send.
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '2rem',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    borderRadius: '1rem',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
  },
  quoteContainer: {
    background: 'white',
    borderRadius: '0.75rem',
    padding: '2rem',
    maxWidth: '600px',
    margin: '0 auto',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
  },
  header: {
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 'bold' as const,
    color: '#667eea',
  },
  client: {
    margin: '0.5rem 0 0 0',
    fontSize: '0.9rem',
    color: '#999',
  },
  itemsContainer: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  quoteItem: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '0.5rem',
    borderLeft: '4px solid #667eea',
  },
  itemLeft: {
    flex: 1,
  },
  itemDescription: {
    fontWeight: 600,
    color: '#333',
    marginBottom: '0.25rem',
  },
  itemDetails: {
    fontSize: '0.85rem',
    color: '#999',
  },
  itemRight: {
    fontWeight: 'bold' as const,
    color: '#667eea',
    fontSize: '0.95rem',
    marginLeft: '1rem',
    textAlign: 'right' as const,
    minWidth: '80px',
  },
  loadingItem: {
    padding: '1rem',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#667eea',
  },
  divider: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '1rem 0',
  },
  totalContainer: {
    padding: '1.5rem',
    backgroundColor: '#f0f4ff',
    borderRadius: '0.5rem',
    textAlign: 'center' as const,
  },
  totalLabel: {
    fontSize: '0.85rem',
    color: '#888',
    marginBottom: '0.5rem',
  },
  totalAmount: {
    fontSize: '2rem',
    fontWeight: 'bold' as const,
    color: '#667eea',
    marginBottom: '0.5rem',
  },
  totalNote: {
    fontSize: '0.8rem',
    color: '#999',
  },
  actionHint: {
    marginTop: '1rem',
    padding: '0.75rem',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    borderRadius: '0.5rem',
    textAlign: 'center' as const,
    fontSize: '0.9rem',
    fontWeight: 500,
  },
};

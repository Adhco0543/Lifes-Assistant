'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { businessProfileManager, BusinessProfile } from '../lib/businessProfile';
import { quotingSystem, Quote, QuoteLineItem } from '../lib/quotingSystem';
import { RichMedia } from './Richmedia';

interface QuoteBuilderProps {
  userId: string;
}

interface FormData {
  clientName: string;
  clientEmail: string;
  projectDescription: string;
  measurements: Record<string, number>;
  specifications: Record<string, string>;
}

export const QuoteBuilder: React.FC<QuoteBuilderProps> = ({ userId }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [formData, setFormData] = useState<FormData>({
    clientName: '',
    clientEmail: '',
    projectDescription: '',
    measurements: {},
    specifications: {},
  });
  const [generatedQuotes, setGeneratedQuotes] = useState<Quote[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tab, setTab] = useState<'builder' | 'quotes'>('builder');

  // Initialize
  useEffect(() => {
    const profile = businessProfileManager.loadProfile(userId);
    if (profile) {
      setBusinessProfile(profile);

      // Load saved quotes from localStorage
      const savedQuotes = localStorage.getItem(`quotes_${userId}`);
      if (savedQuotes) {
        try {
          setGeneratedQuotes(JSON.parse(savedQuotes));
        } catch (e) {
          console.error('Error loading quotes:', e);
        }
      }
    }
  }, [userId]);

  /**
   * Handle form input changes
   */
  const handleInputChange = (
    field: keyof FormData,
    value: string | number,
    subField?: string
  ) => {
    setFormData((prev) => {
      if (subField) {
        return {
          ...prev,
          [field]: {
            ...(prev[field as keyof FormData] as Record<string, any>),
            [subField]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  /**
   * Generate quote from form data
   */
  const handleGenerateQuote = useCallback(async () => {
    if (!businessProfile || !formData.clientName.trim()) {
      alert('Please enter a client name');
      return;
    }

    setIsGenerating(true);

    try {
      const specString = formData.projectDescription || Object.entries(formData.specifications)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      
      const quote = quotingSystem.createQuoteFromMeasurements(
        formData.clientName,
        businessProfile,
        formData.measurements,
        specString
      );

      const newQuotes = [...generatedQuotes, quote];
      setGeneratedQuotes(newQuotes);
      setSelectedQuote(quote);

      // Save to localStorage
      localStorage.setItem(`quotes_${userId}`, JSON.stringify(newQuotes));

      // Track action
      integration.trackUserAction('quote_generated', 'quote_builder', {
        clientName: formData.clientName,
        total: quote.total,
      });

      setTab('quotes');
    } catch (error) {
      console.error('Error generating quote:', error);
      alert('Error generating quote. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [businessProfile, formData, generatedQuotes, userId, integration]);

  /**
   * Export quote to HTML
   */
  const handleExportQuote = useCallback(
    (quote: Quote) => {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Quote - ${quote.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .quote-header { text-align: center; margin-bottom: 30px; }
    .quote-header h1 { margin: 0; }
    .quote-details { margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .totals { text-align: right; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="quote-header">
    <h1>Quote</h1>
    <p><strong>${quote.businessName}</strong></p>
  </div>
  
  <div class="quote-details">
    <p><strong>Client:</strong> ${quote.clientName}</p>
    <p><strong>Date:</strong> ${quote.quoteDate}</p>
    <p><strong>Valid Until:</strong> ${quote.validUntil}</p>
  </div>
  
  <table>
    <tr>
      <th>Description</th>
      <th>Quantity</th>
      <th>Unit</th>
      <th>Rate</th>
      <th>Amount</th>
    </tr>
    ${quote.items.map(item => `
    <tr>
      <td>${item.description}</td>
      <td>${item.quantity}</td>
      <td>${item.unit}</td>
      <td>$${item.rate.toFixed(2)}</td>
      <td>$${item.amount.toFixed(2)}</td>
    </tr>
    `).join('')}
  </table>
  
  <div class="totals">
    <p><strong>Subtotal:</strong> $${quote.subtotal.toFixed(2)}</p>
    <p><strong>Tax (${(quote.taxRate * 100).toFixed(0)}%):</strong> $${quote.tax.toFixed(2)}</p>
    <p style="font-size: 18px;"><strong>Total:</strong> $${quote.total.toFixed(2)}</p>
  </div>
  
  ${quote.notes ? `<p><strong>Notes:</strong> ${quote.notes}</p>` : ''}
</body>
</html>
      `;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quote_${quote.id}.html`;
      link.click();

      integration.trackUserAction('quote_exported', 'quote_builder', {
        quoteId: quote.id,
      });
    },
    [integration]
  );

  /**
   * Delete quote
   */
  const handleDeleteQuote = useCallback(
    (quoteId: string) => {
      const updated = generatedQuotes.filter((q) => q.id !== quoteId);
      setGeneratedQuotes(updated);
      localStorage.setItem(`quotes_${userId}`, JSON.stringify(updated));

      if (selectedQuote?.id === quoteId) {
        setSelectedQuote(null);
      }

      integration.trackUserAction('quote_deleted', 'quote_builder', {
        quoteId,
      });
    },
    [generatedQuotes, selectedQuote, userId, integration]
  );

  if (!businessProfile) {
    return (
      <div className="quote-builder-loading">
        <RichMedia type="animation" animation="pulse" size="lg" />
        <p>Loading Quote Builder...</p>
      </div>
    );
  }

  return (
    <div className={`quote-builder ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <div className="builder-header">
        <h2>
          <RichMedia icon="checkmark" size="lg" /> Quote & Bid Builder
        </h2>
        <p>Create professional quotes for your clients</p>
      </div>

      {/* Tabs */}
      <div className="tab-navigation">
        <button
          className={`tab ${tab === 'builder' ? 'active' : ''}`}
          onClick={() => setTab('builder')}
        >
          New Quote
        </button>
        <button
          className={`tab ${tab === 'quotes' ? 'active' : ''}`}
          onClick={() => setTab('quotes')}
        >
          All Quotes ({generatedQuotes.length})
        </button>
      </div>

      <div className="builder-content">
        {tab === 'builder' ? (
          /* Quote Builder Form */
          <div className="builder-form">
            <div className="form-section">
              <h3>Client Information</h3>
              <div className="form-group">
                <label>Client Name *</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => handleInputChange('clientName', e.target.value)}
                  placeholder="Enter client name"
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                  placeholder="client@example.com"
                />
              </div>
              <div className="form-group">
                <label>Project Description</label>
                <textarea
                  value={formData.projectDescription}
                  onChange={(e) => handleInputChange('projectDescription', e.target.value)}
                  placeholder="Describe the project or work to be done..."
                  rows={4}
                />
              </div>
            </div>

            {/* Measurements */}
            <div className="form-section">
              <h3>Project Measurements</h3>
              <p className="section-hint">
                Enter measurements based on your business type. These help calculate materials
                and labor.
              </p>
              <div className="measurements-grid">
                <div className="form-group">
                  <label>Length (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.measurements.length || ''}
                    onChange={(e) =>
                      handleInputChange(
                        'measurements',
                        parseFloat(e.target.value) || 0,
                        'length'
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Width (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.measurements.width || ''}
                    onChange={(e) =>
                      handleInputChange(
                        'measurements',
                        parseFloat(e.target.value) || 0,
                        'width'
                      )
                    }
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Height (ft)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.measurements.height || ''}
                    onChange={(e) =>
                      handleInputChange(
                        'measurements',
                        parseFloat(e.target.value) || 0,
                        'height'
                      )
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="form-section">
              <h3>Specifications</h3>
              <p className="section-hint">
                Provide any special requirements or materials.
              </p>
              <div className="form-group">
                <label>Materials / Special Requirements</label>
                <textarea
                  value={formData.specifications.materials || ''}
                  onChange={(e) =>
                    handleInputChange('specifications', e.target.value, 'materials')
                  }
                  placeholder="e.g., Premium wood, special finishes, specific materials..."
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Additional Notes</label>
                <textarea
                  value={formData.specifications.notes || ''}
                  onChange={(e) =>
                    handleInputChange('specifications', e.target.value, 'notes')
                  }
                  placeholder="Any other details for this quote..."
                  rows={2}
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              className="generate-button"
              onClick={handleGenerateQuote}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <RichMedia type="animation" animation="spin" size="sm" />
                  Generating...
                </>
              ) : (
                <>
                  <RichMedia icon="arrow" size="sm" />
                  Generate Quote
                </>
              )}
            </button>
          </div>
        ) : (
          /* Quotes List */
          <div className="quotes-list">
            {generatedQuotes.length === 0 ? (
              <div className="empty-state">
                <RichMedia type="visual" size="lg" />
                <h3>No quotes yet</h3>
                <p>Create your first quote to get started</p>
              </div>
            ) : (
              <div className="quotes-grid">
                {generatedQuotes.map((quote) => (
                  <div key={quote.id} className="quote-card">
                    <div className="quote-card-header">
                      <div>
                        <h4>{quote.clientName}</h4>
                        <p className="quote-id">Quote #{quote.id.slice(0, 8)}</p>
                      </div>
                      <div className="quote-amount">${quote.total.toFixed(2)}</div>
                    </div>

                    <div className="quote-items-preview">
                      <p className="items-count">
                        {quote.items.length} item{quote.items.length !== 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className="quote-card-footer">
                      <button
                        className="action-btn view"
                        onClick={() => setSelectedQuote(quote)}
                      >
                        View
                      </button>
                      <button
                        className="action-btn export"
                        onClick={() => handleExportQuote(quote)}
                      >
                        Export
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteQuote(quote.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <div className="quote-detail-modal">
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => setSelectedQuote(null)}
            >
              ✕
            </button>

            <div className="quote-detail">
              <h3>{selectedQuote.clientName}</h3>
              <p className="quote-date">
                Quote #{selectedQuote.id.slice(0, 8)} • Business: {selectedQuote.businessName}
              </p>

              <div className="detail-section">
                <h4>Line Items</h4>
                <table className="line-items-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit</th>
                      <th>Rate</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedQuote.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.description}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unit}</td>
                        <td>${item.rate.toFixed(2)}</td>
                        <td>${item.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="quote-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>${selectedQuote.subtotal.toFixed(2)}</span>
                </div>
                {selectedQuote.tax > 0 && (
                  <div className="total-row">
                    <span>Tax ({(selectedQuote.taxRate * 100).toFixed(0)}%):</span>
                    <span>${selectedQuote.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="total-row grand-total">
                  <span>TOTAL:</span>
                  <span>${selectedQuote.total.toFixed(2)}</span>
                </div>
              </div>

              {selectedQuote.notes && (
                <div className="detail-section">
                  <h4>Notes</h4>
                  <p>{selectedQuote.notes}</p>
                </div>
              )}

              <div className="modal-actions">
                <button
                  className="modal-btn export"
                  onClick={() => {
                    handleExportQuote(selectedQuote);
                    setSelectedQuote(null);
                  }}
                >
                  Export as HTML
                </button>
                <button className="modal-btn" onClick={() => setSelectedQuote(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .quote-builder {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .builder-header {
          background: linear-gradient(135deg, #ffa726 0%, #ff6f00 100%);
          color: white;
          padding: 2rem;
        }

        .builder-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .builder-header p {
          margin: 0.5rem 0 0;
          opacity: 0.9;
        }

        .tab-navigation {
          display: flex;
          border-bottom: 2px solid #f0f0f0;
          background: #fafafa;
        }

        .tab {
          flex: 1;
          padding: 1rem;
          border: none;
          background: none;
          font-size: 1rem;
          font-weight: 600;
          color: #999;
          cursor: pointer;
          transition: all 0.2s ease;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
        }

        .tab.active {
          color: #ff6f00;
          border-bottom-color: #ff6f00;
        }

        .tab:hover {
          color: #ff6f00;
        }

        .builder-content {
          padding: 2rem;
          min-height: 400px;
        }

        .builder-form {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .form-section {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-section h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #333;
        }

        .section-hint {
          margin: 0;
          font-size: 0.9rem;
          color: #999;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          font-size: 0.95rem;
          color: #333;
        }

        .form-group input,
        .form-group textarea {
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 1rem;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #ff6f00;
          box-shadow: 0 0 0 3px rgba(255, 107, 0, 0.1);
        }

        .measurements-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .generate-button {
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #ffa726 0%, #ff6f00 100%);
          color: white;
          border: none;
          border-radius: 0.5rem;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          align-self: flex-start;
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(255, 107, 0, 0.4);
        }

        .generate-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .quotes-list {
          display: flex;
          flex-direction: column;
          min-height: 400px;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex: 1;
          color: #999;
        }

        .empty-state h3 {
          margin: 1rem 0 0.5rem;
          color: #333;
          font-size: 1.2rem;
        }

        .quotes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .quote-card {
          border: 2px solid #f0f0f0;
          border-radius: 0.75rem;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }

        .quote-card:hover {
          border-color: #ff6f00;
          box-shadow: 0 4px 12px rgba(255, 107, 0, 0.1);
        }

        .quote-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .quote-card-header h4 {
          margin: 0;
          font-size: 1.1rem;
        }

        .quote-id {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: #999;
        }

        .quote-amount {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ff6f00;
        }

        .quote-description {
          margin: 0 0 1rem;
          font-size: 0.9rem;
          color: #666;
        }

        .items-count {
          margin: 0 0 1rem;
          font-size: 0.85rem;
          color: #999;
        }

        .quote-card-footer {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          flex: 1;
          padding: 0.5rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.4rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          border-color: #ff6f00;
          color: #ff6f00;
        }

        .action-btn.delete:hover {
          border-color: #f44336;
          color: #f44336;
        }

        .quote-detail-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 1rem;
          padding: 2rem;
          max-width: 700px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
          width: 100%;
        }

        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
        }

        .quote-detail h3 {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
        }

        .quote-date {
          margin: 0 0 1.5rem;
          font-size: 0.9rem;
          color: #999;
        }

        .detail-section {
          margin-bottom: 1.5rem;
        }

        .detail-section h4 {
          margin: 0 0 1rem;
          font-size: 1rem;
          font-weight: 700;
        }

        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }

        .line-items-table th,
        .line-items-table td {
          padding: 0.75rem;
          text-align: right;
          border-bottom: 1px solid #f0f0f0;
        }

        .line-items-table th:first-child,
        .line-items-table td:first-child {
          text-align: left;
        }

        .line-items-table th {
          background: #fafafa;
          font-weight: 700;
          font-size: 0.9rem;
        }

        .quote-totals {
          border-top: 2px solid #f0f0f0;
          padding-top: 1rem;
          margin-bottom: 1.5rem;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-size: 0.95rem;
          color: #666;
        }

        .total-row.grand-total {
          font-size: 1.2rem;
          font-weight: 700;
          color: #333;
        }

        .modal-actions {
          display: flex;
          gap: 1rem;
        }

        .modal-btn {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.5rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-btn.export {
          background: linear-gradient(135deg, #ffa726 0%, #ff6f00 100%);
          color: white;
          border-color: #ff6f00;
        }

        .modal-btn:hover {
          border-color: #ff6f00;
          color: #ff6f00;
        }

        .modal-btn.export:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(255, 107, 0, 0.3);
        }

        .quote-builder-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 400px;
          color: #999;
        }

        @media (max-width: 768px) {
          .builder-header {
            padding: 1.5rem;
          }

          .builder-header h2 {
            font-size: 1.2rem;
          }

          .builder-content {
            padding: 1.5rem;
          }

          .measurements-grid {
            grid-template-columns: 1fr;
          }

          .quotes-grid {
            grid-template-columns: 1fr;
          }

          .modal-content {
            padding: 1.5rem;
          }

          .quote-builder.mobile .builder-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default QuoteBuilder;

'use client';

import React, { useState, useRef, useEffect } from 'react';
import AdvancedConversationalChat from './AdvancedConversationalChat';

interface AIQuoteBuilderProps {
  userId: string;
}

export const AIQuoteBuilder: React.FC<AIQuoteBuilderProps> = ({ userId }) => {
  const [quoteData, setQuoteData] = useState({
    clientName: '',
    projectDescription: '',
    itemsAndPrices: [] as { item: string; price: number; quantity: number }[],
    total: 0,
    notes: '',
  });
  const [aiChat, setAiChat] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState('');
  const [newItem, setNewItem] = useState({ item: '', price: 0, quantity: 1 });

  const addItem = () => {
    if (newItem.item && newItem.price > 0) {
      const updated = [...quoteData.itemsAndPrices, newItem];
      setQuoteData({
        ...quoteData,
        itemsAndPrices: updated,
        total: updated.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      });
      setNewItem({ item: '', price: 0, quantity: 1 });
    }
  };

  const removeItem = (index: number) => {
    const updated = quoteData.itemsAndPrices.filter((_, i) => i !== index);
    setQuoteData({
      ...quoteData,
      itemsAndPrices: updated,
      total: updated.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    });
  };

  const handleAIGenerate = () => {
    if (quoteData.clientName && quoteData.projectDescription) {
      setAiChat(true);
    } else {
      alert('Please enter client name and project description first');
    }
  };

  const handleAIComplete = (message: string) => {
    // AI will generate quote based on message
    const quote = `
Quote #${Date.now()}
Client: ${quoteData.clientName}
Date: ${new Date().toLocaleDateString()}

Project: ${quoteData.projectDescription}

Items:
${quoteData.itemsAndPrices.map(item => `  • ${item.item}: $${item.price} x ${item.quantity} = $${item.price * item.quantity}`).join('\n')}

Total: $${quoteData.total}

AI Notes: ${message}

Terms: Payment due within 30 days of invoice.
    `;
    setGeneratedQuote(quote);
    setAiChat(false);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>💰 AI Quote Builder</h1>

      {!aiChat ? (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* Quote Form */}
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <h2 style={{ marginTop: 0 }}>Create Quote</h2>

            {/* Client Info */}
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }} htmlFor="quote-clientName">Client Name</label>
                <input
                  id="quote-clientName"
                  name="quote-clientName"
                  type="text"
                  placeholder="Enter client name"
                  value={quoteData.clientName}
                  onChange={(e) => setQuoteData({ ...quoteData, clientName: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }} htmlFor="quote-projectDescription">Project Description</label>
                <textarea
                  id="quote-projectDescription"
                  name="quote-projectDescription"
                  placeholder="Describe the project or service"
                  value={quoteData.projectDescription}
                  onChange={(e) => setQuoteData({ ...quoteData, projectDescription: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    minHeight: '100px',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Items & Pricing</h3>

              {/* Add Item */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  id="quote-item-name"
                  name="quote-item-name"
                  type="text"
                  placeholder="Item name"
                  value={newItem.item}
                  onChange={(e) => setNewItem({ ...newItem, item: e.target.value })}
                  style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                />
                <input
                  id="quote-item-price"
                  name="quote-item-price"
                  type="number"
                  placeholder="Price"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) })}
                  style={{ width: '120px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                />
                <input
                  id="quote-item-qty"
                  name="quote-item-qty"
                  type="number"
                  placeholder="Qty"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })}
                  style={{ width: '70px', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
                />
                <button
                  onClick={addItem}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>

              {/* Items List */}
              {quoteData.itemsAndPrices.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto auto',
                    gap: '0.75rem',
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    marginBottom: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <span>{item.item}</span>
                  <span>${item.price}</span>
                  <span>×{item.quantity}</span>
                  <button
                    onClick={() => removeItem(idx)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: '#ff6b6b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '0.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Total */}
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '2rem', padding: '1rem', background: '#f3f4f6', borderRadius: '0.5rem' }}>
              Total: ${quoteData.total.toFixed(2)}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>Additional Notes</label>
              <textarea
                placeholder="Add any notes or special terms"
                value={quoteData.notes}
                onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  minHeight: '80px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleAIGenerate}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                }}
              >
                🤖 Ask AI to Enhance Quote
              </button>
              <button
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                }}
              >
                📤 Send Quote
              </button>
            </div>
          </div>

          {/* Generated Quote Preview */}
          {generatedQuote && (
            <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <h2 style={{ marginTop: 0 }}>Quote Preview</h2>
              <pre
                style={{
                  background: '#f9fafb',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {generatedQuote}
              </pre>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedQuote)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  📋 Copy to Clipboard
                </button>
                <button
                  onClick={() => setGeneratedQuote('')}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f3f4f6',
                    color: '#1f2937',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>AI Quote Assistant</h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>Tell the AI assistant about this quote. They'll help enhance it with recommendations and professional language.</p>
          <AdvancedConversationalChat
            fullScreen={false}
            businessContext="quote-builder"
            onClose={() => setAiChat(false)}
          />
          <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setAiChat(false)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Done with AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

interface AIQuoteBuilderProps {
  userId: string;
}

type LineItem = {
  id: string;
  item: string;
  price: number;
  quantity: number;
};

type ChatResponse = {
  message?: string;
};

export const AIQuoteBuilder: React.FC<AIQuoteBuilderProps> = ({ userId }) => {
  const storageKey = 'lifes-assistant-quotes:' + userId;
  const [clientName, setClientName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem('quote_draft');
      if (!raw) return;
      const handedOff = JSON.parse(raw);
      if (typeof handedOff.projectDescription === 'string') {
        setProjectDescription(handedOff.projectDescription);
      }
      localStorage.removeItem('quote_draft');
    } catch {
      localStorage.removeItem('quote_draft');
    }
  }, []);

  const addItem = () => {
    const price = Number(itemPrice);
    const quantity = Number(itemQuantity);

    if (!itemName.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setStatus('Enter a valid item, price, and quantity.');
      return;
    }

    setItems((current) => current.concat({
      id: 'item-' + Date.now().toString(),
      item: itemName.trim(),
      price,
      quantity,
    }));
    setItemName('');
    setItemPrice('');
    setItemQuantity('1');
    setStatus('');
  };

  const createBasicDraft = () => {
    if (!clientName.trim() || !projectDescription.trim()) {
      setStatus('Enter a client name and project description first.');
      return;
    }

    const lines = items.length
      ? items
          .map((item) =>
            item.item +
            ': $' +
            item.price.toFixed(2) +
            ' x ' +
            item.quantity +
            ' = $' +
            (item.price * item.quantity).toFixed(2)
          )
          .join('\n')
      : 'No line items added yet.';

    setDraft(
      'QUOTE\n' +
      'Client: ' + clientName.trim() + '\n' +
      'Date: ' + new Date().toLocaleDateString() + '\n\n' +
      'Project\n' + projectDescription.trim() + '\n\n' +
      'Items\n' + lines + '\n\n' +
      'Total: $' + total.toFixed(2) +
      (notes.trim() ? '\n\nNotes\n' + notes.trim() : '')
    );
    setStatus('Draft created. Verify scope and pricing before sharing.');
  };

  const polishWithAI = async () => {
    if (!clientName.trim() || !projectDescription.trim()) {
      setStatus('Enter a client name and project description first.');
      return;
    }

    const lines = items.length
      ? items
          .map((item) =>
            item.item +
            ': unit price $' +
            item.price.toFixed(2) +
            ', quantity ' +
            item.quantity +
            ', line total $' +
            (item.price * item.quantity).toFixed(2)
          )
          .join('; ')
      : 'No line items added yet';

    setIsGenerating(true);
    setStatus('');

    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Authentication required');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message:
            'Create a professional quote draft. Keep every amount exactly as provided. Do not invent prices, taxes, discounts, scope, warranties, or payment terms. Client: ' +
            clientName +
            '. Project: ' +
            projectDescription +
            '. Items: ' +
            lines +
            '. Total: $' +
            total.toFixed(2) +
            '. Notes: ' +
            (notes || 'none') +
            '. Return only the quote draft.',
          businessContext: 'quote-drafting',
          chatbotName: "Life's Assistant",
        }),
      });

      if (!response.ok) {
        throw new Error('AI request failed with status ' + response.status);
      }

      const data = (await response.json()) as ChatResponse;
      setDraft(data.message?.trim() || '');
      setStatus(data.message ? 'AI draft ready. Verify scope and pricing before sharing.' : 'No quote draft was returned.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not generate the quote draft.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyDraft = async () => {
    if (!draft.trim()) return;
    try {
      await navigator.clipboard.writeText(draft);
      setStatus('Quote copied.');
    } catch {
      setStatus('Clipboard access was blocked by the browser.');
    }
  };

  const saveDraft = async () => {
    if (!draft.trim()) {
      setStatus('Create a quote draft first.');
      return;
    }

    const payload = {
      clientName,
      projectDescription,
      notes,
      items,
      total,
      draft,
    };

    try {
      await firebaseBackend.saveBusinessRecord('quote', payload);
      await firebaseBackend.trackEvent('quote.saved');
      setStatus('Quote saved to your cloud workspace.');
      return;
    } catch (error) {
      console.warn('Quote cloud save failed, using local fallback:', error);
    }

    try {
      const raw = localStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : [];
      const next = [{
        id: 'quote-' + Date.now().toString(),
        ...payload,
        createdAt: Date.now(),
      }].concat(Array.isArray(existing) ? existing : []).slice(0, 50);

      localStorage.setItem(storageKey, JSON.stringify(next));
      setStatus('Cloud sync is unavailable, so this quote was saved on this device.');
    } catch {
      setStatus('Could not save this quote.');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #414141',
    borderRadius: '10px',
    background: '#1f1f1f',
    color: '#f2f2f2',
    outline: 'none',
  };

  const buttonStyle: React.CSSProperties = {
    minHeight: '42px',
    padding: '0 14px',
    border: 0,
    borderRadius: '10px',
    background: '#ededed',
    color: '#111',
    fontWeight: 650,
    cursor: 'pointer',
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#212121', color: '#ececec' }}>
      <div style={{ width: 'min(1120px, calc(100% - 44px))', margin: '0 auto', padding: '42px 0 70px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ color: '#747474', fontSize: '0.64rem', letterSpacing: '0.14em', fontWeight: 750 }}>QUOTES</div>
          <h1 style={{ margin: '8px 0', fontSize: 'clamp(1.8rem, 4vw, 3rem)', letterSpacing: '-0.045em', fontWeight: 650 }}>
            Build the numbers first. Let AI polish the wording second.
          </h1>
          <p style={{ margin: 0, color: '#858585', fontSize: '0.8rem' }}>
            No hidden taxes, invented line items, or pretend send action.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
          <section style={{ background: '#262626', border: '1px solid #343434', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '7px', color: '#bdbdbd', fontSize: '0.75rem', fontWeight: 600 }}>
                Client name
                <input style={inputStyle} value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name" />
              </label>

              <label style={{ display: 'grid', gap: '7px', color: '#bdbdbd', fontSize: '0.75rem', fontWeight: 600 }}>
                Project description
                <textarea
                  style={{ ...inputStyle, minHeight: '110px', resize: 'vertical' }}
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="Describe exactly what the quote covers."
                />
              </label>

              <div style={{ border: '1px solid #353535', borderRadius: '12px', padding: '12px', background: '#2b2b2b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '9px' }}>
                  <strong style={{ fontSize: '0.75rem' }}>Line items</strong>
                  <strong style={{ fontSize: '0.75rem' }}>{'Total: $' + total.toFixed(2)}</strong>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 95px 70px 58px', gap: '6px' }}>
                  <input style={inputStyle} value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="Item" />
                  <input style={inputStyle} type="number" min="0" step="0.01" value={itemPrice} onChange={(event) => setItemPrice(event.target.value)} placeholder="Price" />
                  <input style={inputStyle} type="number" min="1" step="1" value={itemQuantity} onChange={(event) => setItemQuantity(event.target.value)} placeholder="Qty" />
                  <button style={buttonStyle} onClick={addItem}>Add</button>
                </div>

                {items.length > 0 && (
                  <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto 28px', gap: '8px', alignItems: 'center', padding: '9px 10px', borderRadius: '9px', background: '#242424' }}
                      >
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.7rem' }}>{item.item}</strong>
                          <small style={{ color: '#686868', fontSize: '0.61rem' }}>{'$' + item.price.toFixed(2) + ' x ' + item.quantity}</small>
                        </div>
                        <span style={{ fontSize: '0.7rem' }}>{'$' + (item.price * item.quantity).toFixed(2)}</span>
                        <button
                          style={{ minHeight: '28px', height: '28px', border: 0, background: 'transparent', color: '#777', cursor: 'pointer' }}
                          onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                          aria-label="Remove line item"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ display: 'grid', gap: '7px', color: '#bdbdbd', fontSize: '0.75rem', fontWeight: 600 }}>
                Additional notes
                <textarea
                  style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional exclusions, assumptions, or notes."
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button style={{ ...buttonStyle, background: '#303030', color: '#ededed', border: '1px solid #454545' }} onClick={createBasicDraft}>
                  Create basic draft
                </button>
                <button style={{ ...buttonStyle, opacity: isGenerating ? 0.5 : 1 }} onClick={polishWithAI} disabled={isGenerating}>
                  {isGenerating ? 'Polishing…' : 'Polish with AI'}
                </button>
              </div>
            </div>
          </section>

          <section style={{ background: '#262626', border: '1px solid #343434', borderRadius: '16px', padding: '20px' }}>
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={{ color: '#747474', fontSize: '0.64rem', letterSpacing: '0.14em', fontWeight: 750 }}>PREVIEW</div>
                <h2 style={{ margin: '5px 0 0', fontSize: '1rem' }}>Review before sharing</h2>
              </div>

              <textarea
                style={{ ...inputStyle, minHeight: '470px', resize: 'vertical', lineHeight: 1.5 }}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Your quote draft will appear here."
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button style={{ ...buttonStyle, background: '#303030', color: '#ededed', border: '1px solid #454545' }} onClick={copyDraft} disabled={!draft.trim()}>
                  Copy
                </button>
                <button style={buttonStyle} onClick={saveDraft} disabled={!draft.trim()}>
                  Save draft
                </button>
              </div>

              <div style={{ padding: '13px', border: '1px solid rgba(143,196,255,.22)', background: 'rgba(143,196,255,.04)', borderRadius: '12px' }}>
                <strong style={{ fontSize: '0.73rem' }}>Sending status</strong>
                <p style={{ margin: '4px 0 0', color: '#748597', fontSize: '0.67rem', lineHeight: 1.45 }}>
                  Direct delivery is not connected yet. Copying and saving are real actions.
                </p>
              </div>

              {status && (
                <div role="status" style={{ color: '#9b9b9b', background: '#222', border: '1px solid #343434', borderRadius: '10px', padding: '10px 12px', fontSize: '0.7rem' }}>
                  {status}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AIQuoteBuilder;

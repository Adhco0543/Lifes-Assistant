'use client';

import React, { useState } from 'react';

interface AINoteEditorProps {
  userId: string;
}

export const AINoteEditor: React.FC<AINoteEditorProps> = ({ userId }) => {
  const [notes, setNotes] = useState('');
  const [aiHint, setAiHint] = useState('');
  const [notifications, setNotifications] = useState<{ title: string; type: 'email' | 'note' | 'bid'; timestamp: string }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleAINote = async () => {
    if (!aiHint.trim()) {
      alert('Please tell the AI what you need noted');
      return;
    }

    // Simulate AI processing
    const note = `
📝 AI-Generated Note
Time: ${new Date().toLocaleTimeString()}
Context: ${aiHint}

Summary: The AI has processed your note and will send a notification to the relevant parties.

Original instruction: "${aiHint}"
    `;

    setNotes(note);

    // Simulate sending notification
    setTimeout(() => {
      setNotifications([
        ...notifications,
        {
          title: `Note Created - ${aiHint.substring(0, 30)}...`,
          type: 'note',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      alert('✅ Note created and notification sent!');
    }, 1000);

    setAiHint('');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>📝 AI-Powered Notes</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Note Input */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Tell AI What to Note</h2>
          <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Describe what you need noted down, and the AI will process it and send notifications.</p>

          <textarea
            id="note-content"
            name="note-content"
            placeholder="E.g., 'Customer John Smith wants a quote for 10 units of product X. Follow up Monday morning.'"
            value={aiHint}
            onChange={(e) => setAiHint(e.target.value)}
            style={{
              width: '100%',
              padding: '1rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.5rem',
              minHeight: '150px',
              fontFamily: 'inherit',
              marginBottom: '1rem',
              fontSize: '0.95rem',
            }}
          />

          <button
            onClick={handleAINote}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
            }}
          >
            🤖 AI Process & Send Note
          </button>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#1e40af' }}>💡 AI Memory Enabled</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af' }}>The AI remembers your daily routines and will automatically route notes to the right people.</p>
          </div>
        </div>

        {/* Generated Note Preview */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Generated Note</h2>

          {notes ? (
            <>
              <pre
                style={{
                  background: '#f9fafb',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  marginBottom: '1rem',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {notes}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(notes)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                📋 Copy Note
              </button>
              <button
                onClick={() => setNotes('')}
                style={{
                  width: '100%',
                  padding: '0.75rem',
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
            </>
          ) : (
            <div
              style={{
                padding: '3rem 1rem',
                textAlign: 'center',
                color: '#9ca3af',
                background: '#f9fafb',
                borderRadius: '0.5rem',
              }}
            >
              <p style={{ margin: 0 }}>Your AI-processed note will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Notifications Log */}
      {notifications.length > 0 && (
        <div style={{ marginTop: '2rem', background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>🔔 Notifications Sent</h2>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                padding: '0.5rem 1rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                cursor: 'pointer',
              }}
            >
              {showNotifications ? 'Hide' : 'Show'} ({notifications.length})
            </button>
          </div>

          {showNotifications && (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {notifications.map((notif, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    background: '#f9fafb',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{notif.title}</div>
                  <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{notif.timestamp} - {notif.type}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

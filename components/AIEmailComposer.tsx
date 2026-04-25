'use client';

import React, { useState } from 'react';

interface AIEmailComposerProps {
  userId: string;
}

export const AIEmailComposer: React.FC<AIEmailComposerProps> = ({ userId }) => {
  const [emailData, setEmailData] = useState({
    recipient: '',
    subject: '',
    aiHint: '',
  });
  const [generatedEmail, setGeneratedEmail] = useState('');
  const [emailsSent, setEmailsSent] = useState<string[]>([]);

  const handleAIGenerate = () => {
    if (!emailData.recipient || !emailData.aiHint) {
      alert('Please enter recipient email and what the email should be about');
      return;
    }

    // Simulate AI email generation
    const email = `
To: ${emailData.recipient}
Subject: ${emailData.subject || 'Professional Communication'}

Dear Valued Client,

${emailData.aiHint}

Thank you for your business and continued partnership.

Best regards,
Your Business
    `;

    setGeneratedEmail(email);
  };

  const handleSendEmail = () => {
    if (!generatedEmail) {
      alert('Please generate an email first');
      return;
    }

    // Simulate sending
    setEmailsSent([...emailsSent, `${emailData.recipient} - ${new Date().toLocaleTimeString()}`]);
    alert(`✅ Email sent to ${emailData.recipient}!`);
    
    // Reset form
    setEmailData({ recipient: '', subject: '', aiHint: '' });
    setGeneratedEmail('');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>📧 AI Email Composer</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Email Composer */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Compose with AI</h2>

          <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }} htmlFor="email-recipient">Recipient Email</label>
              <input
                id="email-recipient"
                name="email-recipient"
                type="email"
                placeholder="client@example.com"
                value={emailData.recipient}
                onChange={(e) => setEmailData({ ...emailData, recipient: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }} htmlFor="email-subject">Subject (Optional)</label>
              <input
                id="email-subject"
                name="email-subject"
                type="text"
                placeholder="Email subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }} htmlFor="email-hint">Tell AI What This Email Should Say</label>
              <textarea
                id="email-hint"
                name="email-hint"
                placeholder="E.g., 'Send a follow-up about the quote we sent yesterday for the renovation project...'"
                value={emailData.aiHint}
                onChange={(e) => setEmailData({ ...emailData, aiHint: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  minHeight: '150px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <button
            onClick={handleAIGenerate}
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
            🤖 AI Generate Email
          </button>

          <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fef3c7', borderRadius: '0.5rem', border: '1px solid #fcd34d' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#b45309' }}>💡 Pro Tip</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#b45309' }}>The AI learns your email style from your daily routines and can automatically draft follow-ups.</p>
          </div>
        </div>

        {/* Generated Email Preview */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0 }}>Email Preview</h2>

          {generatedEmail ? (
            <>
              <pre
                style={{
                  background: '#f9fafb',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  marginBottom: '1rem',
                  maxHeight: '300px',
                  overflow: 'auto',
                  fontSize: '0.9rem',
                }}
              >
                {generatedEmail}
              </pre>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <button
                  onClick={handleSendEmail}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  📤 Send Email
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(generatedEmail)}
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
                  📋 Copy
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '4rem 1rem',
                textAlign: 'center',
                color: '#9ca3af',
                background: '#f9fafb',
                borderRadius: '0.5rem',
              }}
            >
              <p style={{ margin: 0 }}>Your AI-generated email will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Sent Emails Log */}
      {emailsSent.length > 0 && (
        <div style={{ marginTop: '2rem', background: 'white', padding: '2rem', borderRadius: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>✅ Emails Sent ({emailsSent.length})</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {emailsSent.map((email, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem',
                  background: '#f9fafb',
                  borderRadius: '0.5rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.9rem',
                }}
              >
                📤 {email}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

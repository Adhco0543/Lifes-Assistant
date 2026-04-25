'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { businessProfileManager, BusinessProfile } from '../lib/businessProfile';
import { RichMedia } from './Richmedia';

interface EmailComposerProps {
  userId: string;
}

interface Email {
  id: string;
  to: string;
  subject: string;
  body: string;
  template: string;
  createdAt: number;
  sentAt?: number;
  status: 'draft' | 'sent';
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: string[];
}

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    id: 'quote-follow-up',
    name: 'Quote Follow-up',
    subject: 'Your Quote for {{projectName}} - {{companyName}}',
    body: `Hi {{clientName}},

I hope this email finds you well. I wanted to follow up on the quote I provided for your {{projectName}} project.

The estimate includes:
- {{estimateAmount}} for labor and materials
- Timeline: {{timeline}}
- All work includes warranty and quality guarantee

Please let me know if you have any questions or would like to discuss any modifications.

Best regards,
{{companyName}}`,
    variables: ['projectName', 'companyName', 'clientName', 'estimateAmount', 'timeline'],
  },
  {
    id: 'project-update',
    name: 'Project Update',
    subject: 'Project Update: {{projectName}}',
    body: `Hi {{clientName}},

I wanted to provide you with an update on your {{projectName}} project.

Current Status: {{status}}
Progress: {{progress}}%
Expected Completion: {{completionDate}}

{{updateDetails}}

Please feel free to reach out if you have any questions.

Best regards,
{{companyName}}`,
    variables: ['projectName', 'clientName', 'status', 'progress', 'completionDate', 'updateDetails', 'companyName'],
  },
  {
    id: 'invoice-reminder',
    name: 'Invoice Reminder',
    subject: 'Invoice {{invoiceNumber}} - Payment Reminder',
    body: `Hi {{clientName}},

This is a friendly reminder that payment for invoice {{invoiceNumber}} is due.

Invoice Amount: {{amount}}
Due Date: {{dueDate}}

Please submit payment at your earliest convenience. If you have already sent payment, please disregard this reminder.

Thank you for your business!

{{companyName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate', 'companyName'],
  },
  {
    id: 'meeting-invite',
    name: 'Meeting Invitation',
    subject: 'Meeting Invitation: {{meetingTitle}}',
    body: `Hi {{clientName}},

I would like to schedule a meeting with you to discuss {{meetingTopic}}.

Proposed Time: {{meetingTime}}
Duration: {{duration}} minutes
Location/Video: {{location}}

Please confirm if this time works for you, or feel free to suggest an alternative.

Looking forward to speaking with you.

Best regards,
{{companyName}}`,
    variables: ['clientName', 'meetingTitle', 'meetingTopic', 'meetingTime', 'duration', 'location', 'companyName'],
  },
];

export const EmailComposer: React.FC<EmailComposerProps> = ({ userId }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [view, setView] = useState<'inbox' | 'compose' | 'templates'>('inbox');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  // Form state for composing
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: '',
    template: 'custom',
  });

  // Template variables
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Initialize
  useEffect(() => {
    const profile = businessProfileManager.loadProfile(userId);
    if (profile) {
      setBusinessProfile(profile);

      // Load saved emails from localStorage
      const savedEmails = localStorage.getItem(`emails_${userId}`);
      if (savedEmails) {
        try {
          setEmails(JSON.parse(savedEmails));
        } catch (e) {
          console.error('Error loading emails:', e);
        }
      }
    }
  }, [userId]);

  /**
   * Handle template selection
   */
  const handleSelectTemplate = useCallback((template: EmailTemplate) => {
    setSelectedTemplate(template);
    setComposeData((prev) => ({
      ...prev,
      template: template.id,
      subject: template.subject,
      body: template.body,
    }));

    const vars: Record<string, string> = {};
    template.variables.forEach((v) => {
      vars[v] = '';
    });
    if (businessProfile) {
      vars['companyName'] = businessProfile.businessName;
    }
    setTemplateVars(vars);

    setView('compose');
    integration.trackUserAction('template_selected', 'email_composer', {
      template: template.id,
    });
  }, [businessProfile, integration]);

  /**
   * Replace template variables
   */
  const getProcessedBody = useCallback(() => {
    let body = composeData.body;
    Object.entries(templateVars).forEach(([key, value]) => {
      body = body.replace(`{{${key}}}`, value);
    });
    return body;
  }, [composeData.body, templateVars]);

  /**
   * Handle send email
   */
  const handleSendEmail = useCallback(() => {
    if (!composeData.to.trim() || !composeData.subject.trim() || !composeData.body.trim()) {
      alert('Please fill in all required fields: To, Subject, and Message');
      return;
    }

    const email: Email = {
      id: `email-${Date.now()}`,
      to: composeData.to,
      subject: composeData.subject,
      body: getProcessedBody(),
      template: composeData.template,
      createdAt: Date.now(),
      sentAt: Date.now(),
      status: 'sent',
    };

    const updated = [email, ...emails];
    setEmails(updated);
    localStorage.setItem(`emails_${userId}`, JSON.stringify(updated));

    // Reset form
    setComposeData({
      to: '',
      subject: '',
      body: '',
      template: 'custom',
    });
    setTemplateVars({});
    setSelectedTemplate(null);
    setView('inbox');

    integration.trackUserAction('email_sent', 'email_composer', {
      to: composeData.to,
      template: composeData.template,
    });

    alert('Email sent successfully!');
  }, [composeData, emails, userId, getProcessedBody, integration]);

  /**
   * Save as draft
   */
  const handleSaveDraft = useCallback(() => {
    const email: Email = {
      id: `email-${Date.now()}`,
      to: composeData.to,
      subject: composeData.subject,
      body: composeData.body,
      template: composeData.template,
      createdAt: Date.now(),
      status: 'draft',
    };

    const updated = [email, ...emails];
    setEmails(updated);
    localStorage.setItem(`emails_${userId}`, JSON.stringify(updated));

    integration.trackUserAction('email_draft_saved', 'email_composer', {
      template: composeData.template,
    });

    alert('Draft saved!');
  }, [composeData, emails, userId, integration]);

  /**
   * Delete email
   */
  const handleDeleteEmail = useCallback(
    (emailId: string) => {
      const updated = emails.filter((e) => e.id !== emailId);
      setEmails(updated);
      localStorage.setItem(`emails_${userId}`, JSON.stringify(updated));
      if (selectedEmail?.id === emailId) {
        setSelectedEmail(null);
      }

      integration.trackUserAction('email_deleted', 'email_composer', {
        emailId,
      });
    },
    [emails, selectedEmail, userId, integration]
  );

  return (
    <div className={`email-composer ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <div className="composer-header">
        <h2>
          <RichMedia icon="settings" size="lg" /> Email Manager
        </h2>
        <p>Send emails and manage communication</p>
      </div>

      {/* Tabs */}
      <div className="tab-navigation">
        <button
          className={`tab ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => setView('inbox')}
        >
          Inbox ({emails.filter((e) => e.status === 'sent').length})
        </button>
        <button
          className={`tab ${view === 'compose' ? 'active' : ''}`}
          onClick={() => {
            setComposeData({ to: '', subject: '', body: '', template: 'custom' });
            setTemplateVars({});
            setSelectedTemplate(null);
            setView('compose');
          }}
        >
          Compose
        </button>
        <button
          className={`tab ${view === 'templates' ? 'active' : ''}`}
          onClick={() => setView('templates')}
        >
          Templates
        </button>
      </div>

      {/* Content */}
      <div className="composer-content">
        {view === 'inbox' && (
          <div className="inbox-view">
            {emails.length === 0 ? (
              <div className="empty-state">
                <RichMedia type="visual" size="lg" />
                <h3>No emails yet</h3>
                <p>Start by composing your first email</p>
              </div>
            ) : (
              <div className="emails-list">
                {emails
                  .filter((e) => e.status === 'sent')
                  .map((email) => (
                    <div
                      key={email.id}
                      className="email-item"
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="email-header">
                        <p className="email-to">{email.to}</p>
                        <p className="email-date">
                          {new Date(email.sentAt || email.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="email-subject">{email.subject}</p>
                      <div className="email-actions">
                        <button
                          className="action-btn delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEmail(email.id);
                          }}
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

        {view === 'compose' && (
          <div className="compose-view">
            <div className="form-group">
              <label>To *</label>
              <input
                type="email"
                placeholder="recipient@example.com"
                value={composeData.to}
                onChange={(e) => setComposeData((prev) => ({ ...prev, to: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label>Subject *</label>
              <input
                type="text"
                placeholder="Email subject"
                value={composeData.subject}
                onChange={(e) =>
                  setComposeData((prev) => ({ ...prev, subject: e.target.value }))
                }
              />
            </div>

            {selectedTemplate && Object.keys(templateVars).length > 0 && (
              <div className="template-vars">
                <h3>Template Variables</h3>
                {Object.entries(templateVars).map(([key, value]) => (
                  <div key={key} className="var-input">
                    <label>{key}</label>
                    <input
                      type="text"
                      placeholder={`Enter ${key}`}
                      value={value}
                      onChange={(e) =>
                        setTemplateVars((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="form-group">
              <label>Message *</label>
              <textarea
                placeholder="Email body"
                value={composeData.body}
                onChange={(e) =>
                  setComposeData((prev) => ({ ...prev, body: e.target.value }))
                }
                rows={10}
              />
            </div>

            <div className="compose-actions">
              <button className="btn-secondary" onClick={() => setView('inbox')}>
                Back
              </button>
              <button className="btn-secondary" onClick={handleSaveDraft}>
                Save Draft
              </button>
              <button className="btn-primary" onClick={handleSendEmail}>
                Send Email
              </button>
            </div>
          </div>
        )}

        {view === 'templates' && (
          <div className="templates-view">
            <div className="templates-grid">
              {DEFAULT_TEMPLATES.map((template) => (
                <div key={template.id} className="template-card">
                  <h3>{template.name}</h3>
                  <p className="template-subject">{template.subject}</p>
                  <p className="template-preview">
                    {template.body.substring(0, 100)}...
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => handleSelectTemplate(template)}
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedEmail && (
        <div className="email-detail-modal">
          <div className="modal-overlay" onClick={() => setSelectedEmail(null)} />
          <div className="modal-content">
            <button
              className="modal-close"
              onClick={() => setSelectedEmail(null)}
            >
              ✕
            </button>
            <div className="email-detail">
              <p><strong>To:</strong> {selectedEmail.to}</p>
              <p><strong>Subject:</strong> {selectedEmail.subject}</p>
              <p><strong>Sent:</strong> {new Date(selectedEmail.sentAt || selectedEmail.createdAt).toLocaleString()}</p>
              <div className="email-body">
                {selectedEmail.body}
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .email-composer {
          background: white;
          border-radius: 1rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .composer-header {
          background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
          color: white;
          padding: 2rem;
        }

        .composer-header h2 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .composer-header p {
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
          color: #2196f3;
          border-bottom-color: #2196f3;
        }

        .composer-content {
          flex: 1;
          overflow-y: auto;
          padding: 2rem;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 300px;
          color: #999;
        }

        .empty-state h3 {
          color: #333;
          margin: 1rem 0 0.5rem;
        }

        .emails-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .email-item {
          border: 2px solid #f0f0f0;
          border-radius: 0.75rem;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .email-item:hover {
          border-color: #2196f3;
          box-shadow: 0 2px 8px rgba(33, 150, 243, 0.1);
        }

        .email-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .email-to {
          margin: 0;
          font-weight: 700;
          color: #333;
        }

        .email-date {
          margin: 0;
          font-size: 0.85rem;
          color: #999;
        }

        .email-subject {
          margin: 0.5rem 0 1rem;
          color: #666;
        }

        .email-actions {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          padding: 0.375rem 0.75rem;
          border: 2px solid #e0e0e0;
          background: white;
          border-radius: 0.4rem;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn.delete {
          color: #f44336;
          border-color: #f44336;
        }

        .action-btn.delete:hover {
          background: #f44336;
          color: white;
        }

        .compose-view {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          font-size: 0.95rem;
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
          border-color: #2196f3;
          box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
        }

        .template-vars {
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 0.5rem;
        }

        .template-vars h3 {
          margin: 0 0 1rem;
          color: #333;
          font-size: 1rem;
        }

        .var-input {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .var-input label {
          font-size: 0.85rem;
          font-weight: 600;
          color: #666;
        }

        .var-input input {
          padding: 0.5rem;
          border: 1px solid #d0d0d0;
          border-radius: 0.375rem;
          font-family: inherit;
        }

        .compose-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }

        .btn-primary,
        .btn-secondary {
          flex: 1;
          padding: 0.75rem 1.5rem;
          border: 2px solid transparent;
          border-radius: 0.5rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: #2196f3;
          color: white;
        }

        .btn-primary:hover {
          background: #1976d2;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
          border-color: #e0e0e0;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        .templates-view {
          padding: 1rem 0;
        }

        .templates-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .template-card {
          border: 2px solid #f0f0f0;
          border-radius: 0.75rem;
          padding: 1.5rem;
          transition: all 0.2s ease;
        }

        .template-card:hover {
          border-color: #2196f3;
          box-shadow: 0 4px 12px rgba(33, 150, 243, 0.1);
        }

        .template-card h3 {
          margin: 0 0 0.75rem;
          color: #333;
          font-size: 1.1rem;
        }

        .template-subject {
          margin: 0 0 0.75rem;
          color: #666;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .template-preview {
          margin: 0 0 1rem;
          color: #999;
          font-size: 0.85rem;
          line-height: 1.4;
          min-height: 50px;
        }

        .template-card .btn-primary {
          width: 100%;
        }

        .email-detail-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: 1rem;
          padding: 2rem;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          width: 90%;
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

        .email-detail p {
          margin: 0 0 1rem;
          color: #333;
        }

        .email-detail strong {
          color: #666;
        }

        .email-body {
          background: #f5f5f5;
          padding: 1.5rem;
          border-radius: 0.5rem;
          white-space: pre-wrap;
          word-wrap: break-word;
          color: #333;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .composer-header {
            padding: 1.5rem;
          }

          .composer-content {
            padding: 1.5rem;
          }

          .templates-grid {
            grid-template-columns: 1fr;
          }

          .modal-content {
            width: 95%;
            max-height: 90vh;
          }
        }
      `}</style>
    </div>
  );
};

export default EmailComposer;

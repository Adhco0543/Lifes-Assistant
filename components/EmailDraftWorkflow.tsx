"use client";

import React, { useEffect, useState } from "react";
import { emailService, EmailMessage } from "@/lib/emailService";
import { useIntelligenceLayer } from "@/lib/useIntelligenceLayer";

interface EmailDraftWorkflowProps {
  userId: string;
  onSent?: (email: EmailMessage) => void;
  initialEmail?: Partial<EmailMessage>;
}

export function EmailDraftWorkflow({
  userId,
  onSent,
  initialEmail,
}: EmailDraftWorkflowProps) {
  const [step, setStep] = useState<"compose" | "suggestions" | "preview" | "sending">(
    "compose"
  );
  const [formData, setFormData] = useState({
    to: initialEmail?.to
      ? Array.isArray(initialEmail.to)
        ? initialEmail.to.join(", ")
        : initialEmail.to
      : "",
    cc: initialEmail?.cc ? initialEmail.cc.join(", ") : "",
    bcc: initialEmail?.bcc ? initialEmail.bcc.join(", ") : "",
    subject: initialEmail?.subject || "",
    body: initialEmail?.body || "",
  });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { decisions: { stats } } = useIntelligenceLayer(userId);

  useEffect(() => {
    if (step === "suggestions" && formData.body.length > 20) {
      generateSuggestions();
    }
  }, [step]);

  const generateSuggestions = () => {
    // AI-assisted suggestions based on context
    const contextualSuggestions = [
      "Keep it brief and professional",
      "Include a clear call-to-action",
      "Personalize with client name",
      "Add urgency if time-sensitive",
      "Consider mentioning previous conversations",
    ];
    setSuggestions(contextualSuggestions.slice(0, 3));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async () => {
    setLoading(true);
    setError("");

    try {
      const toEmails = formData.to
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (toEmails.length === 0) {
        setError("Please enter at least one recipient");
        setLoading(false);
        return;
      }

      if (!formData.subject.trim()) {
        setError("Subject is required");
        setLoading(false);
        return;
      }

      setStep("sending");

      // Try Gmail first, fall back to Outlook
      const settings = await emailService.getSettings(userId);

      if (settings?.gmailConnected && settings.gmailAccessToken) {
        await emailService.sendViaGmail(userId, settings.gmailAccessToken, {
          from: "user@gmail.com",
          to: toEmails,
          cc: formData.cc ? formData.cc.split(",").map((e) => e.trim()) : undefined,
          bcc: formData.bcc ? formData.bcc.split(",").map((e) => e.trim()) : undefined,
          subject: formData.subject,
          body: formData.body,
        });
      } else if (settings?.outlookConnected && settings.outlookAccessToken) {
        await emailService.sendViaOutlook(userId, settings.outlookAccessToken, {
          from: "user@outlook.com",
          to: toEmails,
          cc: formData.cc ? formData.cc.split(",").map((e) => e.trim()) : undefined,
          bcc: formData.bcc ? formData.bcc.split(",").map((e) => e.trim()) : undefined,
          subject: formData.subject,
          body: formData.body,
        });
      } else {
        setError("No email account connected. Please connect Gmail or Outlook first.");
        setStep("compose");
        setLoading(false);
        return;
      }

      // Reset and notify
      setFormData({ to: "", cc: "", bcc: "", subject: "", body: "" });
      setStep("compose");
      onSent?.(
        {
          id: `draft_${Date.now()}`,
          userId,
          from: "user@example.com",
          to: toEmails,
          subject: formData.subject,
          body: formData.body,
          provider: "gmail",
          isRead: true,
          isDraft: false,
          sentAt: new Date(),
        } as EmailMessage
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
      setStep("compose");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="email-draft-workflow">
      {/* Compose Step */}
      {step === "compose" && (
        <div className="compose-form">
          <div className="form-group">
            <label>To:</label>
            <input
              type="email"
              name="to"
              value={formData.to}
              onChange={handleChange}
              placeholder="recipient@example.com, another@example.com"
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>Cc:</label>
              <input
                type="text"
                name="cc"
                value={formData.cc}
                onChange={handleChange}
                placeholder="cc@example.com"
              />
            </div>
            <div className="form-group flex-1">
              <label>Bcc:</label>
              <input
                type="text"
                name="bcc"
                value={formData.bcc}
                onChange={handleChange}
                placeholder="bcc@example.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Subject:</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Email subject"
            />
          </div>

          <div className="form-group">
            <label>Message:</label>
            <textarea
              name="body"
              value={formData.body}
              onChange={handleChange}
              placeholder="Write your email..."
              rows={8}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="button-group">
            <button
              className="btn btn-secondary"
              onClick={() => setStep("suggestions")}
              disabled={formData.body.length < 10}
            >
              💡 Get Suggestions
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => setStep("preview")}
              disabled={!formData.to || !formData.subject}
            >
              👁️ Preview
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={!formData.to || !formData.subject || loading}
            >
              {loading ? "Sending..." : "📤 Send"}
            </button>
          </div>
        </div>
      )}

      {/* Suggestions Step */}
      {step === "suggestions" && (
        <div className="suggestions-panel">
          <h3>📝 AI Writing Suggestions</h3>
          <div className="suggestions-list">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="suggestion-item">
                <input type="checkbox" defaultChecked />
                <span>{suggestion}</span>
              </div>
            ))}
          </div>
          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setStep("compose")}>
              ← Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep("preview")}>
              Continue to Preview →
            </button>
          </div>
        </div>
      )}

      {/* Preview Step */}
      {step === "preview" && (
        <div className="preview-panel">
          <h3>👁️ Email Preview</h3>
          <div className="preview-email">
            <div className="preview-field">
              <span className="label">To:</span>
              <span className="value">{formData.to}</span>
            </div>
            {formData.cc && (
              <div className="preview-field">
                <span className="label">Cc:</span>
                <span className="value">{formData.cc}</span>
              </div>
            )}
            <div className="preview-field">
              <span className="label">Subject:</span>
              <span className="value">{formData.subject}</span>
            </div>
            <div className="preview-body">
              <div className="label">Message:</div>
              <div className="value">{formData.body}</div>
            </div>
          </div>
          <div className="button-group">
            <button className="btn btn-secondary" onClick={() => setStep("compose")}>
              ← Edit
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSend}
              disabled={loading}
            >
              {loading ? "Sending..." : "📤 Send Email"}
            </button>
          </div>
        </div>
      )}

      {/* Sending Step */}
      {step === "sending" && (
        <div className="sending-panel">
          <div className="spinner"></div>
          <p>Sending email...</p>
        </div>
      )}

      <style jsx>{`
        .email-draft-workflow {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          max-width: 600px;
          margin: 0 auto;
        }

        .compose-form,
        .suggestions-panel,
        .preview-panel,
        .sending-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .form-group input,
        .form-group textarea {
          padding: 10px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13px;
          color: #333;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          border-left: 3px solid #ff6b6b;
          color: #c62828;
          font-size: 13px;
          border-radius: 4px;
        }

        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 6px;
          font-size: 13px;
        }

        .suggestion-item input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .preview-email {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .preview-field {
          display: flex;
          gap: 12px;
          font-size: 13px;
        }

        .preview-field .label {
          font-weight: 600;
          color: #666;
          min-width: 80px;
        }

        .preview-field .value {
          color: #333;
          flex: 1;
          word-break: break-all;
        }

        .preview-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid #e0e0e0;
          padding-top: 12px;
        }

        .preview-body .label {
          font-weight: 600;
          color: #666;
          font-size: 13px;
        }

        .preview-body .value {
          white-space: pre-wrap;
          color: #333;
          font-size: 13px;
          line-height: 1.5;
        }

        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
        }

        .btn-primary {
          background: #4171ff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2e5dd9;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #d0d0d0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e0e0e0;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sending-panel {
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 16px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #f0f0f0;
          border-top-color: #4171ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .flex-1 {
          flex: 1;
        }

        @media (max-width: 768px) {
          .form-row {
            grid-template-columns: 1fr;
          }

          .button-group {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default EmailDraftWorkflow;

"use client";

import React, { useEffect, useState } from "react";
import { emailService, EmailMessage } from "@/lib/emailService";

interface EmailPanelProps {
  userId: string;
  maxItems?: number;
}

export function EmailPanel({ userId, maxItems = 10 }: EmailPanelProps) {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [drafts, setDrafts] = useState<EmailMessage[]>([]);
  const [tab, setTab] = useState<"inbox" | "drafts">("inbox");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmails();
  }, [userId, tab]);

  const loadEmails = async () => {
    setLoading(true);
    try {
      if (tab === "inbox") {
        const messages = await emailService.getInboxMessages(userId, maxItems);
        setEmails(messages);
        setUnreadCount(messages.filter((m) => !m.isRead).length);
      } else {
        const draftMessages = await emailService.getDrafts(userId);
        setDrafts(draftMessages.slice(0, maxItems));
      }
    } catch (error) {
      console.error("Error loading emails:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (emailId: string) => {
    try {
      await emailService.markAsRead(userId, emailId);
      if (tab === "inbox") {
        setEmails((prev) =>
          prev.map((e) => (e.id === emailId ? { ...e, isRead: true } : e))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error marking email as read:", error);
    }
  };

  const handleDelete = async (emailId: string) => {
    try {
      await emailService.deleteEmail(userId, emailId);
      if (tab === "inbox") {
        setEmails((prev) => prev.filter((e) => e.id !== emailId));
      } else {
        setDrafts((prev) => prev.filter((e) => e.id !== emailId));
      }
    } catch (error) {
      console.error("Error deleting email:", error);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const currentList = tab === "inbox" ? emails : drafts;

  return (
    <div className="email-panel">
      <div className="panel-header">
        <h3>📧 Email</h3>
        {tab === "inbox" && unreadCount > 0 && (
          <span className="unread-badge">{unreadCount}</span>
        )}
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-btn ${tab === "inbox" ? "active" : ""}`}
          onClick={() => setTab("inbox")}
        >
          📥 Inbox
        </button>
        <button
          className={`tab-btn ${tab === "drafts" ? "active" : ""}`}
          onClick={() => setTab("drafts")}
        >
          📝 Drafts
        </button>
      </div>

      {loading ? (
        <div className="loading-state">
          <p>Loading emails...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="empty-state">
          <p>{tab === "inbox" ? "No emails" : "No drafts"}</p>
        </div>
      ) : (
        <div className="email-list">
          {currentList.map((email) => (
            <div
              key={email.id}
              className={`email-item ${email.isRead ? "" : "unread"}`}
            >
              <div className="email-checkbox">
                <input type="checkbox" />
              </div>
              <div className="email-content">
                <div className="email-from">
                  <span className="sender">{extractName(email.from)}</span>
                  {!email.isRead && <span className="unread-indicator">●</span>}
                </div>
                <div className="email-subject">{email.subject}</div>
                <div className="email-preview">{email.body.substring(0, 60)}...</div>
              </div>
              <div className="email-meta">
                <span className="email-date">{formatDate(email.sentAt)}</span>
                <div className="email-actions">
                  {!email.isRead && (
                    <button
                      className="action-btn"
                      title="Mark as read"
                      onClick={() => handleMarkAsRead(email.id)}
                    >
                      ✓
                    </button>
                  )}
                  <button
                    className="action-btn delete"
                    title="Delete"
                    onClick={() => handleDelete(email.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .email-panel {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .unread-badge {
          background: #ff6b6b;
          color: white;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .tab-navigation {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .tab-btn {
          padding: 8px 12px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          font-size: 13px;
          font-weight: 600;
          color: #999;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn.active {
          color: #4171ff;
          border-bottom-color: #4171ff;
        }

        .tab-btn:hover {
          color: #333;
        }

        .loading-state,
        .empty-state {
          padding: 20px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .email-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          overflow: hidden;
        }

        .email-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
          background: white;
          transition: all 0.2s ease;
        }

        .email-item:last-child {
          border-bottom: none;
        }

        .email-item:hover {
          background: #f9f9f9;
        }

        .email-item.unread {
          background: #f0f5ff;
        }

        .email-checkbox {
          display: flex;
          align-items: center;
        }

        .email-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }

        .email-content {
          flex: 1;
          min-width: 0;
        }

        .email-from {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
        }

        .sender {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .unread-indicator {
          color: #4171ff;
          font-size: 16px;
          flex-shrink: 0;
        }

        .email-subject {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .email-preview {
          font-size: 12px;
          color: #999;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .email-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }

        .email-date {
          font-size: 11px;
          color: #999;
          white-space: nowrap;
        }

        .email-actions {
          display: flex;
          gap: 4px;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: 1px solid #d0d0d0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
          opacity: 0;
        }

        .email-item:hover .action-btn {
          opacity: 1;
        }

        .action-btn:hover {
          background: #fff3cd;
          border-color: #ffc107;
        }

        .action-btn.delete:hover {
          background: #ffebee;
          border-color: #ff6b6b;
        }

        @media (max-width: 768px) {
          .email-meta {
            flex-direction: row;
            align-items: center;
          }

          .email-date {
            flex: 1;
          }

          .action-btn {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function extractName(email: string): string {
  const match = email.match(/(.*?)\s*<|^([^@]+)/);
  return match ? (match[1] || match[2]).trim() : email;
}

export default EmailPanel;

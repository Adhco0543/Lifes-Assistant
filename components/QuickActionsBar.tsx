"use client";

import React from "react";

interface QuickActionsBarProps {
  userId: string;
  onAction?: (action: string) => void;
}

export function QuickActionsBar({ userId, onAction }: QuickActionsBarProps) {
  const actions = [
    {
      id: "email",
      label: "Draft Email",
      icon: "📧",
      description: "Compose and send",
      color: "#667eea",
    },
    {
      id: "quote",
      label: "New Quote",
      icon: "📝",
      description: "Generate quote",
      color: "#ff6b6b",
    },
    {
      id: "materials",
      label: "Materials",
      icon: "📋",
      description: "Calculate costs",
      color: "#ffc107",
    },
    {
      id: "reminder",
      label: "Set Reminder",
      icon: "⏰",
      description: "Schedule follow-up",
      color: "#4caf50",
    },
    {
      id: "voice",
      label: "Record Job",
      icon: "🎙️",
      description: "Voice capture",
      color: "#2196f3",
    },
  ];

  const handleAction = (actionId: string) => {
    onAction?.(actionId);
  };

  return (
    <div className="quick-actions-bar">
      <div className="actions-grid">
        {actions.map((action) => (
          <button
            key={action.id}
            className="action-btn"
            onClick={() => handleAction(action.id)}
            style={{ borderLeftColor: action.color }}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-text">
              <div className="action-label">{action.label}</div>
              <div className="action-desc">{action.description}</div>
            </div>
            <div className="action-arrow">→</div>
          </button>
        ))}
      </div>

      <style jsx>{`
        .quick-actions-bar {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: #f9f9f9;
          border: none;
          border-left: 3px solid #667eea;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .action-btn:hover {
          background: #f0f0f0;
          transform: translateX(2px);
        }

        .action-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .action-text {
          flex: 1;
          min-width: 0;
        }

        .action-label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
        }

        .action-desc {
          font-size: 11px;
          color: #999;
        }

        .action-arrow {
          color: #ddd;
          font-size: 14px;
          flex-shrink: 0;
        }

        .action-btn:hover .action-arrow {
          color: #667eea;
        }

        @media (max-width: 1024px) {
          .actions-grid {
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          }
        }

        @media (max-width: 768px) {
          .actions-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .action-btn {
            padding: 10px;
          }

          .action-icon {
            font-size: 16px;
          }

          .action-label {
            font-size: 12px;
          }

          .action-desc {
            display: none;
          }
        }

        @media (max-width: 480px) {
          .actions-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default QuickActionsBar;

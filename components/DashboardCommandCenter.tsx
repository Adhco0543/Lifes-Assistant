'use client';

import React, { useState } from 'react';
import { RichMedia } from './Richmedia';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
}

interface DashboardCommandCenterProps {
  userId: string;
  onActionSelect: (action: string) => void;
}

export const DashboardCommandCenter: React.FC<DashboardCommandCenterProps> = ({
  userId,
  onActionSelect,
}) => {
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const quickActions: QuickAction[] = [
    {
      id: 'chat',
      title: 'AI Chat',
      description: 'Talk to your AI business advisor',
      icon: 'chat',
      color: '#3B82F6',
      action: () => onActionSelect('chat'),
    },
    {
      id: 'generate-email',
      title: 'Generate Email',
      description: 'Write professional emails instantly',
      icon: 'email',
      color: '#10B981',
      action: () => onActionSelect('email'),
    },
    {
      id: 'create-quote',
      title: 'Create Quote',
      description: 'Build sales quotes and proposals',
      icon: 'receipt',
      color: '#F59E0B',
      action: () => onActionSelect('quotes'),
    },
    {
      id: 'analyze-materials',
      title: 'Materials Estimator',
      description: 'Estimate costs and resources',
      icon: 'calculator',
      color: '#8B5CF6',
      action: () => onActionSelect('materials'),
    },
    {
      id: 'take-notes',
      title: 'Take Notes',
      description: 'Save and organize your ideas',
      icon: 'note',
      color: '#EC4899',
      action: () => onActionSelect('notes'),
    },
    {
      id: 'view-tasks',
      title: 'Task Queue',
      description: 'Manage your automated tasks',
      icon: 'tasks',
      color: '#06B6D4',
      action: () => onActionSelect('tasks'),
    },
  ];

  return (
    <div className="dashboard-command-center">
      <style jsx>{`
        .dashboard-command-center {
          padding: 40px 20px;
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100vh;
          animation: fadeIn 0.4s ease-in;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .command-center-header {
          max-width: 1200px;
          margin: 0 auto 50px;
          text-align: center;
        }

        .command-center-header h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 10px 0;
          letter-spacing: -0.5px;
        }

        .command-center-header p {
          font-size: 1.1rem;
          color: #6b7280;
          margin: 0;
        }

        .command-center-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 30px;
        }

        .title-icon {
          font-size: 2rem;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .action-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 2px solid transparent;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
        }

        .action-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--card-color), rgba(0, 0, 0, 0.1));
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }

        .action-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15);
          border-color: var(--card-color);
        }

        .action-card:hover::before {
          transform: scaleX(1);
        }

        .action-icon {
          width: 50px;
          height: 50px;
          border-radius: 10px;
          background: var(--card-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.8rem;
          margin-bottom: 16px;
          opacity: 0.9;
        }

        .action-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .action-description {
          font-size: 0.95rem;
          color: #6b7280;
          margin: 0;
          line-height: 1.4;
        }

        .action-arrow {
          position: absolute;
          right: 20px;
          bottom: 20px;
          opacity: 0;
          transform: translateX(-8px);
          transition: all 0.3s ease;
          color: var(--card-color);
          font-size: 1.5rem;
        }

        .action-card:hover .action-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        @media (max-width: 768px) {
          .dashboard-command-center {
            padding: 20px;
          }

          .command-center-header {
            margin-bottom: 40px;
          }

          .command-center-header h1 {
            font-size: 1.8rem;
          }

          .quick-actions-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .action-card {
            padding: 16px;
          }
        }
      `}</style>

      <div className="command-center-header">
        <div className="command-center-title">
          <span className="title-icon">⚡</span>
          <h1>Quick Actions</h1>
        </div>
        <p>Pick what you want to do next</p>
      </div>

      <div className="quick-actions-grid">
        {quickActions.map((action) => (
          <div
            key={action.id}
            className="action-card"
            onClick={action.action}
            onMouseEnter={() => setHoveredAction(action.id)}
            onMouseLeave={() => setHoveredAction(null)}
            style={
              {
                '--card-color': action.color,
              } as React.CSSProperties
            }
          >
            <div className="action-icon" style={{ backgroundColor: action.color }}>
              {action.icon === 'chat' && '💬'}
              {action.icon === 'email' && '✉️'}
              {action.icon === 'receipt' && '📄'}
              {action.icon === 'calculator' && '🧮'}
              {action.icon === 'note' && '📝'}
              {action.icon === 'tasks' && '✓'}
            </div>
            <h3 className="action-title">{action.title}</h3>
            <p className="action-description">{action.description}</p>
            <div className="action-arrow">→</div>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: '1200px', margin: '80px auto 0', padding: '0 20px' }}>
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '30px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 20, color: '#1f2937' }}>💡 Pro Tips</h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
            }}
          >
            <li style={{ color: '#4b5563', lineHeight: 1.6 }}>
              <strong>Press ⌘K</strong> to open the command palette from anywhere
            </li>
            <li style={{ color: '#4b5563', lineHeight: 1.6 }}>
              <strong>Use AI Chat</strong> for personalized business advice and strategy
            </li>
            <li style={{ color: '#4b5563', lineHeight: 1.6 }}>
              <strong>Save your notes</strong> and access them anytime across devices
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

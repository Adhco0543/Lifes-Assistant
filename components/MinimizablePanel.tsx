'use client';

import React, { useState } from 'react';

interface MinimizablePanelProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  defaultMinimized?: boolean;
}

export const MinimizablePanel: React.FC<MinimizablePanelProps> = ({
  title,
  icon,
  children,
  defaultMinimized = false,
}) => {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);

  return (
    <div
      style={{
        background: 'white',
        border: '2px solid #e5e7eb',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          {icon && <span style={{ fontSize: '1.25rem' }}>{icon}</span>}
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>{title}</h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMinimized(!isMinimized);
          }}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
          }}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div
          style={{
            padding: '1.5rem',
            animation: 'slideDown 0.3s ease',
          }}
        >
          {children}
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

'use client';

import React, { useState, useRef, ReactNode } from 'react';

interface DraggableWindowProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultMinimized?: boolean;
  onClose?: () => void;
  width?: string;
}

export const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  title,
  children,
  defaultPosition = { x: 0, y: 0 },
  defaultMinimized = false,
  onClose,
  width = '400px',
}) => {
  const [position, setPosition] = useState(defaultPosition);
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [isClosed, setIsClosed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  if (isClosed) return null;

  const handleHeaderMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Prevent dragging when clicking buttons
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClose = () => {
    setIsClosed(true);
    onClose?.();
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  return (
    <div
      ref={windowRef}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={isDragging ? handleMouseUp : undefined}
      onMouseLeave={isDragging ? handleMouseUp : undefined}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? 'auto' : width,
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
        zIndex: isDragging ? 10000 : 1000,
        display: 'flex',
        flexDirection: 'column',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          borderRadius: '12px 12px 0 0',
          cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <h3
          style={{
            margin: 0,
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          {title}
        </h3>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleMinimize}
            type="button"
            title={isMinimized ? 'Expand' : 'Minimize'}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
          >
            {isMinimized ? '□' : '−'}
          </button>

          <button
            onClick={handleClose}
            type="button"
            title="Close"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 59, 48, 0.8)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            maxHeight: '600px',
            minHeight: '100px',
          }}
        >
          {children}
        </div>
      )}

      {isMinimized && (
        <div
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            color: '#666',
            backgroundColor: '#f5f5f5',
            borderRadius: '0 0 12px 12px',
            textAlign: 'center',
          }}
        >
          (minimized)
        </div>
      )}
    </div>
  );
};

export default DraggableWindow;

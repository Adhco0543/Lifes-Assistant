'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PendingTasksPanel } from './PendingTasksPanel';
import { CustomTaskPanel } from './CustomTaskPanel';

interface TasksViewProps {
  userId: string;
}

export const TasksView: React.FC<TasksViewProps> = ({ userId }) => {
  const [tasksMinimized, setTasksMinimized] = useState(false);
  const [customTasksMinimized, setCustomTasksMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef({ x: 20, y: 20 });
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Handle window drag (move)
  const handleTitleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    dragOffsetRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    setIsDragging(true);
  };

  // Global mouse listeners for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
      positionRef.current = { x: newX, y: newY };
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('mouseup', handleMouseUp, false);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('mouseup', handleMouseUp, false);
    };
  }, [isDragging]);

  // Handle minimize
  const handleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTasksMinimized(true);
    setCustomTasksMinimized(true);
  };

  // Handle maximize
  const handleMaximize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTasksMinimized(false);
    setCustomTasksMinimized(false);
  };

  // Handle close
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsVisible(false);
  };

  if (!isVisible) return null;
  const isMinimized = tasksMinimized && customTasksMinimized;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isMinimized ? '300px' : '1200px',
        height: isMinimized ? '50px' : '600px',
        background: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: isDragging ? 'grabbing' : 'default',
        pointerEvents: 'auto',
        transition: !isDragging ? 'all 0.2s ease' : 'none',
      }}
    >
      {/* Title Bar - Window Controls */}
      <div
        onMouseDown={handleTitleMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          color: 'white',
          fontWeight: '600',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          borderBottom: isMinimized ? 'none' : '1px solid #374151',
          flexShrink: 0,
          pointerEvents: 'auto',
          minHeight: '50px',
          borderRadius: '0.5rem 0.5rem 0 0',
        }}
      >
        <span style={{ flex: 1 }}>📋 Task Queue & Activity</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Minimize Button */}
          <button
            onClick={handleMinimize}
            title="Minimize"
            style={{
              background: '#4b5563',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#5a6675')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#4b5563')}
          >
            −
          </button>

          {/* Maximize Button */}
          <button
            onClick={handleMaximize}
            title="Maximize"
            style={{
              background: '#4b5563',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#5a6675')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#4b5563')}
          >
            ☐
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            title="Close"
            style={{
              background: '#ef4444',
              border: 'none',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              pointerEvents: 'auto',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#dc2626')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#ef4444')}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content Area */}
      {!isMinimized && (
        <div style={{ overflow: 'auto', flex: 1, padding: '2rem', minHeight: 0, pointerEvents: 'auto' }}>
        {/* Pending Tasks */}
        {!tasksMinimized && (
          <div style={{ marginBottom: '2rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                borderRadius: '0.5rem 0.5rem 0 0',
                fontWeight: '600',
                userSelect: 'none',
              }}
            >
              <span>📋 Pending Tasks</span>
            </div>
            <div
              style={{
                padding: '1.5rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0 0 0.5rem 0.5rem',
                borderTop: 'none',
              }}
            >
              <PendingTasksPanel userId={userId} />
            </div>
          </div>
        )}

        {/* Custom Tasks */}
        {!customTasksMinimized && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                borderRadius: '0.5rem 0.5rem 0 0',
                fontWeight: '600',
                userSelect: 'none',
              }}
            >
              <span>✨ Ask AI Task</span>
            </div>
            <div
              style={{
                padding: '1.5rem',
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '0 0 0.5rem 0.5rem',
                borderTop: 'none',
              }}
            >
              <CustomTaskPanel userId={userId} />
            </div>
          </div>
        )}

        {/* Both minimized state */}
        {tasksMinimized && customTasksMinimized && (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: '#9ca3af',
            }}
          >
            <p>All panels minimized. Use the maximize button (☐) to expand.</p>
          </div>
        )}
        </div>
      )}
    </div>
  );
};

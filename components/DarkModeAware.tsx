'use client';

import React from 'react';

interface DarkModeAwareCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  elevated?: boolean;
  hover?: boolean;
  interactive?: boolean;
}

export const DarkModeAwareCard: React.FC<DarkModeAwareCardProps> = ({
  children,
  style,
  className,
  elevated = false,
  hover = true,
  interactive = false,
}) => {
  const baseStyle = {
    backgroundColor: 'var(--bg-surface, white)',
    color: 'var(--text-primary, #1f2937)',
    borderColor: 'var(--border-color, #e5e7eb)',
    border: '1px solid var(--border-color, #e5e7eb)',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    transition: 'all 0.3s ease',
    ...style,
  };

  const hoverStyle = hover
    ? {
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
        transform: 'translateY(-2px)',
      }
    : {};

  const elevatedStyle = elevated
    ? {
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
      }
    : {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
      };

  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        ...elevatedStyle,
        cursor: interactive ? 'pointer' : 'default',
      }}
      onMouseEnter={(e) => {
        if (hover && interactive) {
          Object.assign(e.currentTarget.style, hoverStyle);
        }
      }}
      onMouseLeave={(e) => {
        if (hover && interactive) {
          Object.assign(e.currentTarget.style, elevatedStyle);
        }
      }}
    >
      {children}
    </div>
  );
};

interface DarkModeAwareTextProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  as?: 'p' | 'span' | 'div';
  style?: React.CSSProperties;
}

export const DarkModeAwareText: React.FC<DarkModeAwareTextProps> = ({
  children,
  variant = 'primary',
  as: Component = 'p',
  style,
}) => {
  const colorMap: Record<string, string> = {
    primary: 'var(--text-primary, #1f2937)',
    secondary: 'var(--text-secondary, #6b7280)',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  };

  return (
    <Component style={{ color: colorMap[variant], ...style }}>
      {children}
    </Component>
  );
};

interface DarkModeAwareButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: React.ReactNode;
}

export const DarkModeAwareButton: React.FC<DarkModeAwareButtonProps> = ({
  variant = 'primary',
  children,
  style,
  ...props
}) => {
  const variantStyles = {
    primary: {
      backgroundColor: '#3b82f6',
      color: 'white',
      border: 'none',
    },
    secondary: {
      backgroundColor: 'rgba(0, 0, 0, 0.1)',
      color: 'var(--text-primary, #1f2937)',
      border: '1px solid var(--border-color, #e5e7eb)',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: '#3b82f6',
      border: '2px solid #3b82f6',
    },
  };

  return (
    <button
      style={{
        padding: '0.75rem 1.5rem',
        borderRadius: '0.5rem',
        cursor: 'pointer',
        fontWeight: 500,
        transition: 'all 0.3s ease',
        ...variantStyles[variant],
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.opacity = '0.9';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.opacity = '1';
      }}
      {...props}
    >
      {children}
    </button>
  );
};

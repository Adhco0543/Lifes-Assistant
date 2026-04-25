'use client';

import React from 'react';
import { EnhancedDashboard } from './EnhancedDashboard';

export const EnhancedDashboardWithTheme: React.FC<{ userId: string }> = ({
  userId,
}) => {
  // Use default colors that work with light/dark theme
  const themeColors = {
    background: 'var(--bg-primary, #ffffff)',
    text: 'var(--text-primary, #1f2937)',
    textSecondary: 'var(--text-secondary, #6b7280)',
    surface: 'var(--bg-surface, #f9fafb)',
    border: 'var(--border-color, #e5e7eb)',
    primary: '#3b82f6',
  };

  return (
    <EnhancedDashboard
      userId={userId}
      themeColors={themeColors}
    />
  );
};

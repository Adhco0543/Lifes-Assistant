'use client';

import React from 'react';
import { ThemeProvider } from './ThemeProvider';
import { ThemeSwitcher } from './ThemeSwitcher';
import EnhancedApp from './EnhancedApp';

export const PageWithTheme: React.FC<{ userId: string }> = ({ userId }) => {
  return (
    <ThemeProvider>
      <EnhancedApp userId={userId} />
      <ThemeSwitcher position="top-right" />
    </ThemeProvider>
  );
};

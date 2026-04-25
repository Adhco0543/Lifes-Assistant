'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeMode, themeManager } from '../lib/theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>(() =>
    themeManager.getCurrentTheme()
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    themeManager.applyTheme(theme.mode);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme.mode === 'auto') {
        setTheme(themeManager.getCurrentTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme.mode]);

  const toggleTheme = () => {
    const newMode = themeManager.toggleTheme();
    setTheme(themeManager.getCurrentTheme());
  };

  const setMode = (mode: ThemeMode) => {
    themeManager.setThemeMode(mode);
    setTheme(themeManager.getCurrentTheme());
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within ThemeProvider');
  }
  return context;
};

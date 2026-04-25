// Theme management system
import React from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColor {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  gradient: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColor;
}

const LIGHT_THEME: ThemeColor = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#11998e',
  warning: '#FFB84D',
  error: '#f5576c',
  background: '#f8f9fa',
  surface: '#ffffff',
  text: '#000000',
  textSecondary: '#666666',
  border: '#f0f0f0',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const DARK_THEME: ThemeColor = {
  primary: '#667eea',
  secondary: '#764ba2',
  success: '#11998e',
  warning: '#FFB84D',
  error: '#f5576c',
  background: '#0f0f0f',
  surface: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  border: '#2a2a2a',
  gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const STORAGE_KEY = 'theme_preference';

export const themeManager = {
  getColorScheme(mode: ThemeMode): ThemeColor {
    if (mode === 'auto') {
      const prefersDark = typeof window !== 'undefined' 
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
        : false;
      return prefersDark ? DARK_THEME : LIGHT_THEME;
    }
    return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
  },

  getCurrentTheme(): Theme {
    const stored =
      typeof window !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null;
    const mode = (stored as ThemeMode) || 'auto';
    return {
      mode,
      colors: this.getColorScheme(mode),
    };
  },

  setThemeMode(mode: ThemeMode): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    this.applyTheme(mode);
  },

  applyTheme(mode: ThemeMode): void {
    const colors = this.getColorScheme(mode);
    if (typeof window !== 'undefined' && document.documentElement) {
      // Set CSS variables
      document.documentElement.style.setProperty(
        '--color-primary',
        colors.primary
      );
      document.documentElement.style.setProperty(
        '--color-secondary',
        colors.secondary
      );
      document.documentElement.style.setProperty(
        '--color-success',
        colors.success
      );
      document.documentElement.style.setProperty(
        '--color-warning',
        colors.warning
      );
      document.documentElement.style.setProperty('--color-error', colors.error);
      document.documentElement.style.setProperty(
        '--color-background',
        colors.background
      );
      document.documentElement.style.setProperty(
        '--color-surface',
        colors.surface
      );
      document.documentElement.style.setProperty('--color-text', colors.text);
      document.documentElement.style.setProperty(
        '--color-text-secondary',
        colors.textSecondary
      );
      document.documentElement.style.setProperty(
        '--color-border',
        colors.border
      );

      // Update body background
      document.body.style.backgroundColor = colors.background;
      document.body.style.color = colors.text;
    }
  },

  toggleTheme(): ThemeMode {
    const current = this.getCurrentTheme();
    const next = current.mode === 'light' ? 'dark' : 'light';
    this.setThemeMode(next);
    return next;
  },
};

// React Hook for theme management
export const useTheme = () => {
  const [theme, setTheme] = React.useState<Theme>(() =>
    themeManager.getCurrentTheme()
  );

  React.useEffect(() => {
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

  return {
    theme,
    toggleTheme,
    setMode: (mode: ThemeMode) => {
      themeManager.setThemeMode(mode);
      setTheme(themeManager.getCurrentTheme());
    },
  };
};

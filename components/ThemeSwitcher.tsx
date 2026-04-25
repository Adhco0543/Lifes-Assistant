'use client';

import React, { useEffect, useState } from 'react';

interface ThemeSwitcherProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  style?: React.CSSProperties;
  showLabel?: boolean;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  position = 'top-right',
  style,
  showLabel = true,
}) => {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme-mode') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme-mode', newTheme);
    document.documentElement.style.colorScheme = newTheme;
    
    // Apply theme to entire page
    if (newTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.backgroundColor = '#1f2937';
      document.body.style.backgroundColor = '#1f2937';
      document.body.style.color = '#f0f0f0';
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.backgroundColor = '#ffffff';
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    }
  };

  if (!mounted) {
    return null;
  }

  const positionStyles = {
    'top-right': { top: '1.5rem', right: '1.5rem' },
    'top-left': { top: '1.5rem', left: '1.5rem' },
    'bottom-right': { bottom: '1.5rem', right: '1.5rem' },
    'bottom-left': { bottom: '1.5rem', left: '1.5rem' },
  };

  return (
    <div
      style={{
        ...styles.container,
        ...positionStyles[position],
        ...style,
      }}
    >
      <div style={styles.buttonGroup}>
        <button
          onClick={toggleTheme}
          style={{
            ...styles.modeButton,
            ...(theme === 'light' ? styles.modeButtonActive : {}),
          }}
          title="Light mode"
        >
          ☀️
        </button>
        <button
          onClick={toggleTheme}
          style={{
            ...styles.modeButton,
            ...(theme === 'dark' ? styles.modeButtonActive : {}),
          }}
          title="Dark mode"
        >
          🌙
        </button>
      </div>
      {showLabel && (
        <span style={styles.label}>
          {theme === 'dark' ? 'Dark' : 'Light'}
        </span>
      )}
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed' as const,
    zIndex: 1000,
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '0.75rem',
    padding: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    border: '2px solid #f0f0f0',
    borderRadius: '2rem',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  buttonGroup: {
    display: 'flex' as const,
    gap: '0.25rem',
    padding: '0.25rem',
    backgroundColor: '#f5f5f5',
    borderRadius: '1.5rem',
  },
  modeButton: {
    padding: '0.5rem 0.75rem',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: '1rem',
    cursor: 'pointer',
    fontSize: '1rem',
    transition: 'all 0.3s ease',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modeButtonActive: {
    backgroundColor: '#667eea',
    color: 'white',
    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.4)',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#666',
    paddingRight: '0.5rem',
  },
};

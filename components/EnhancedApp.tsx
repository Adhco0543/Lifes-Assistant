'use client';

import React, { useState, useEffect } from "react";
import { GreetingSystem } from "./GreetingSystem";
import { ActivityFeed } from "./ActivityFeed";
import { CommandPalette } from "./CommandPalette";
import App from "./App";

interface EnhancedAppProps {
  userId: string;
}

export function EnhancedApp({ userId }: EnhancedAppProps) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);
  const [greetingComplete, setGreetingComplete] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-mode') || 'light';
    document.documentElement.style.colorScheme = savedTheme;
    if (savedTheme === 'dark') {
      document.documentElement.style.backgroundColor = '#1f2937';
      document.body.style.backgroundColor = '#1f2937';
    } else {
      document.documentElement.style.backgroundColor = '#ffffff';
      document.body.style.backgroundColor = '#ffffff';
    }
  }, []);

  // Open command palette with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Detect onboarding mode by checking if onboarding component is visible
  useEffect(() => {
    const checkOnboarding = () => {
      const onboardingElement = document.querySelector('[data-testid="progressive-onboarding"]');
      setIsOnboarding(!!onboardingElement);
    };

    checkOnboarding();
    
    // Check periodically in case the component is added/removed dynamically
    const interval = setInterval(checkOnboarding, 500);
    return () => clearInterval(interval);
  }, []);

  // Auto-hide greeting after a few seconds
  useEffect(() => {
    if (greetingComplete) {
      const timer = setTimeout(() => {
        setShowGreeting(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [greetingComplete]);

  return (
    <div className="enhanced-app-wrapper">
      {/* Greeting System */}
      {showGreeting && (
        <GreetingSystem
          userId={userId}
          onGreetingComplete={() => setGreetingComplete(true)}
        />
      )}

      {/* Main App */}
      <div className="app-main-section">
        <App userId={userId} />
      </div>

      {/* Activity Feed - Sidebar on desktop, modal on mobile */}
      {!isOnboarding && (
        <div className="activity-feed-container">
          <ActivityFeed userId={userId} />
        </div>
      )}

      {/* Command Palette */}
      {!isOnboarding && (
        <CommandPalette
          userId={userId}
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}

      {/* Keyboard shortcut hint */}
      {!isOnboarding && (
        <div className="keyboard-hint">
          Press <kbd>⌘K</kbd> for commands
        </div>
      )}

      <style jsx>{`
        .enhanced-app-wrapper {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .app-main-section {
          flex: 1;
        }

        .activity-feed-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 100%;
          max-width: 400px;
          max-height: 500px;
          z-index: 50;
        }

        .keyboard-hint {
          position: fixed;
          bottom: 20px;
          left: 20px;
          font-size: 12px;
          color: #999;
          background: rgba(255, 255, 255, 0.9);
          padding: 8px 12px;
          border-radius: 6px;
          border: 1px solid #eee;
          display: flex;
          align-items: center;
          gap: 6px;
          z-index: 40;
        }

        kbd {
          background: #f5f5f5;
          padding: 2px 6px;
          border-radius: 3px;
          border: 1px solid #ddd;
          font-family: monospace;
          font-size: 11px;
        }

        @media (max-width: 1200px) {
          .activity-feed-container {
            max-width: 350px;
          }
        }

        @media (max-width: 768px) {
          .activity-feed-container {
            position: fixed;
            bottom: 0;
            right: 0;
            left: 0;
            max-width: 100%;
            max-height: 300px;
            width: auto;
            border-radius: 12px 12px 0 0;
            margin: 10px;
            bottom: 70px;
            right: 10px;
            left: 10px;
          }

          .keyboard-hint {
            bottom: 90px;
            left: 10px;
            right: auto;
          }
        }

        @media (max-width: 480px) {
          .activity-feed-container {
            display: none;
          }

          .keyboard-hint {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

export default EnhancedApp;

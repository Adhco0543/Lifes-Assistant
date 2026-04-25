'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Dashboard from './Dashboard';
import AdvancedConversationalChat from './AdvancedConversationalChat';
import MaterialEstimator from './MaterialEstimator';
import Progressiveonboarding from './Progressiveonboarding';
import AuthForm from './AuthForm';
import { RichMedia } from './Richmedia';
import { businessProfileManager } from '../lib/businessProfile';
import { firebaseBackend } from '../lib/firebaseBackend';
import { useAppIntegration } from '../lib/hooks';
import NotificationSystem from './NotificationSystem';
import { IntelligentBackgroundWorker } from '../lib/intelligentBackgroundWorker';
import { TasksView } from './TasksView';
import { TeamWorkspace } from './TeamWorkspace';
import { BusinessRecommendations } from './BusinessRecommendations';
import { AppCustomization } from './AppCustomization';
import { SettingsHub } from './SettingsHub';
import { AIQuoteBuilder } from './AIQuoteBuilder';
import { AINoteEditor } from './AINoteEditor';
import { AIEmailComposer } from './AIEmailComposer';

type ViewType =
  | 'dashboard'
  | 'chat'
  | 'quotes'
  | 'notes'
  | 'email'
  | 'materials'
  | 'onboarding'
  | 'settings'
  | 'tasks'
  | 'team'
  | 'recommendations'
  | 'customization';

interface AppProps {
  userId?: string;
}

export const App: React.FC<AppProps> = ({ userId = 'default-user' }) => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [hasProfile, setHasProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [businessType, setBusinessType] = useState('business');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const initializeRef = useRef(false);
  const workerUserIdRef = useRef<string | null>(null);

  const effectiveUserId = useMemo(
    () => (isAuthenticated ? userId : 'default-user'),
    [isAuthenticated, userId]
  );

  const integration = useAppIntegration(effectiveUserId);

  const stopActiveWorker = useCallback(() => {
    if (workerUserIdRef.current) {
      try {
        IntelligentBackgroundWorker.stop(workerUserIdRef.current);
      } catch (error) {
        console.error('Error stopping background worker:', error);
      } finally {
        workerUserIdRef.current = null;
      }
    }
  }, []);

  const startWorkerForUser = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) return;

      if (workerUserIdRef.current === targetUserId) return;

      stopActiveWorker();

      try {
        IntelligentBackgroundWorker.start(targetUserId);
        workerUserIdRef.current = targetUserId;
      } catch (error) {
        console.error('Error starting background worker:', error);
      }
    },
    [stopActiveWorker]
  );

  const applyProfileState = useCallback(
    (targetUserId: string) => {
      const profile = businessProfileManager.loadProfile(targetUserId);

      if (!profile) {
        setHasProfile(false);
        setBusinessType('business');
        setCurrentView('onboarding');
        return false;
      }

      setHasProfile(true);
      setBusinessType(profile.businessType || 'business');
      setCurrentView('dashboard');
      startWorkerForUser(targetUserId);
      return true;
    },
    [startWorkerForUser]
  );

  const hydrateFromAuthState = useCallback(async () => {
    try {
      await firebaseBackend.initialize();
      const currentUser = firebaseBackend.getCurrentUser();

      if (currentUser) {
        setIsAuthenticated(true);
        const loaded = applyProfileState(currentUser.uid);

        if (!loaded) {
          stopActiveWorker();
        }

        return;
      }

      setIsAuthenticated(false);
      const loaded = applyProfileState('default-user');

      if (!loaded) {
        stopActiveWorker();
      }
    } catch (error) {
      console.error('Error hydrating auth state:', error);
      setIsAuthenticated(false);

      const loaded = applyProfileState('default-user');
      if (!loaded) {
        stopActiveWorker();
      }
    }
  }, [applyProfileState, stopActiveWorker]);

  useEffect(() => {
    if (initializeRef.current) return;
    initializeRef.current = true;

    const initializeApp = async () => {
      try {
        await hydrateFromAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [hydrateFromAuthState]);

  useEffect(() => {
    return () => {
      stopActiveWorker();
    };
  }, [stopActiveWorker]);

  const handleAuthSuccess = useCallback(async () => {
    setIsLoading(true);

    try {
      await firebaseBackend.initialize();
      const currentUser = firebaseBackend.getCurrentUser();

      if (currentUser) {
        setIsAuthenticated(true);
        const loaded = applyProfileState(currentUser.uid);

        if (!loaded) {
          stopActiveWorker();
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error after auth success:', error);
    } finally {
      setIsLoading(false);
    }
  }, [applyProfileState, stopActiveWorker]);

  const handleOnboardingComplete = useCallback(
    (data: any) => {
      const completedUserId = effectiveUserId;

      const businessName =
        data?.businessName ||
        data?.responses?.businessName ||
        data?.responses?.[1] ||
        'My Business';

      const nextBusinessType =
        data?.businessType ||
        data?.responses?.businessType ||
        data?.responses?.[2] ||
        'business';

      // Create or update business profile
      try {
        businessProfileManager.updateProfile(completedUserId, {
          businessName,
          businessType: nextBusinessType as any,
        });
      } catch (error) {
        // Profile doesn't exist yet, that's OK for demo
        console.log('Profile update skipped (demo mode)', error);
      }

      setBusinessType(nextBusinessType);
      setHasProfile(true);
      setCurrentView('dashboard');
      startWorkerForUser(completedUserId);
    },
    [effectiveUserId, startWorkerForUser]
  );

  if (isLoading) {
    return (
      <div className="app-loading">
        <div className="loading-container">
          <RichMedia type="animation" animation="pulse" size="xl" />
          <h1>Loading Business AI Assistant...</h1>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !hasProfile) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app-container">
      <NotificationSystem userId={effectiveUserId} />

      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h1 className="logo">
            <RichMedia icon="settings" size="md" /> AI Assistant
          </h1>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('dashboard');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'dashboard' });
            }}
          >
            <RichMedia icon="settings" size="sm" />
            Dashboard
          </button>

          <button
            className={`nav-item ${currentView === 'chat' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('chat');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'chat' });
            }}
          >
            <RichMedia icon="settings" size="sm" />
            AI Chat
          </button>

          <button
            className={`nav-item ${currentView === 'quotes' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('quotes');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'quotes' });
            }}
          >
            <RichMedia icon="checkmark" size="sm" />
            Quotes & Bids
          </button>

          <button
            className={`nav-item ${currentView === 'notes' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('notes');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'notes' });
            }}
          >
            <RichMedia icon="heart" size="sm" />
            Notes
          </button>

          <button
            className={`nav-item ${currentView === 'email' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('email');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'email' });
            }}
          >
            <RichMedia icon="star" size="sm" />
            Email
          </button>

          <button
            className={`nav-item ${currentView === 'materials' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('materials');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'materials' });
            }}
          >
            <RichMedia icon="arrow" size="sm" />
            Materials
          </button>

          <div className="sidebar-divider"></div>

          <button
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('settings');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'settings' });
            }}
          >
            <RichMedia icon="settings" size="sm" />
            Settings
          </button>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '1rem 0' }} />

          <button
            className={`nav-item ${currentView === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('tasks');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'tasks' });
            }}
          >
            ✓ Task Queue
          </button>

          <button
            className={`nav-item ${currentView === 'team' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('team');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'team' });
            }}
          >
            👥 Team
          </button>

          <button
            className={`nav-item ${currentView === 'recommendations' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('recommendations');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'recommendations' });
            }}
          >
            🔧 Tools & Safety
          </button>

          <button
            className={`nav-item ${currentView === 'customization' ? 'active' : ''}`}
            onClick={() => {
              setCurrentView('customization');
              integration.trackUserAction('nav_click', 'sidebar', { view: 'customization' });
            }}
          >
            🎨 Customize
          </button>
        </nav>

        <div className="sidebar-footer">
          <p>© 2024 Business AI Assistant</p>
        </div>
      </div>

      <div className="main-content">
        {currentView === 'onboarding' && (
          <Progressiveonboarding
            userId={effectiveUserId}
            onComplete={handleOnboardingComplete}
          />
        )}

        {currentView === 'dashboard' && (
          <>
            <Dashboard
              userId={effectiveUserId}
              onViewChange={setCurrentView}
              businessType={businessType}
            />
            {/* Floating Tasks Panel on Dashboard */}
            <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 500 }}>
              <TasksView userId={effectiveUserId} />
            </div>
          </>
        )}

        {currentView === 'quotes' && <AIQuoteBuilder userId={effectiveUserId} />}
        {currentView === 'notes' && <AINoteEditor userId={effectiveUserId} />}
        {currentView === 'email' && <AIEmailComposer userId={effectiveUserId} />}
        {currentView === 'materials' && <MaterialEstimator userId={effectiveUserId} />}
        {currentView === 'settings' && <SettingsHub userId={effectiveUserId} />}
        {currentView === 'tasks' && <TasksView userId={effectiveUserId} />}
        {currentView === 'team' && (
          <TeamWorkspace userId={effectiveUserId} businessName={businessType} />
        )}
        {currentView === 'recommendations' && (
          <BusinessRecommendations businessType={businessType} />
        )}
        {currentView === 'customization' && (
          <AppCustomization userId={effectiveUserId} />
        )}
      </div>

      {currentView === 'chat' && (
        <AdvancedConversationalChat
          userId={effectiveUserId}
          fullScreen
          businessContext={businessType}
        />
      )}

      {hasProfile && currentView === 'dashboard' && (
        chatOpen ? (
          <AdvancedConversationalChat
            userId={effectiveUserId}
            businessContext={businessType}
            onClose={() => setChatOpen(false)}
            fullScreen={false}
          />
        ) : (
          <button
            className="floating-chat-fab"
            onClick={() => setChatOpen(true)}
            title="Open AI Chat"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </button>
        )
      )}

      <style jsx>{`
        .app-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          color: white;
        }

        .loading-container h1 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .app-container {
          display: flex;
          height: 100vh;
          background: #f5f5f5;
        }

        .sidebar {
          width: 280px;
          background: white;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow-y: auto;
          transition: all 0.3s ease;
          position: relative;
          z-index: 100;
        }

        .sidebar.closed {
          width: 0;
          overflow: hidden;
          box-shadow: none;
        }

        .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .logo {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .sidebar-toggle {
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.5rem;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          padding: 1rem;
          gap: 0.5rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          border: none;
          border-radius: 12px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 0.95rem;
          transition: background 0.2s ease;
          min-height: 44px;
        }

        .nav-item:hover {
          background: #f3f4f6;
        }

        .nav-item.active {
          background: #e8f0ff;
          color: #2563eb;
          font-weight: 600;
        }

        .sidebar-divider {
          height: 1px;
          background: #ececec;
          margin: 0.75rem 0;
        }

        .sidebar-footer {
          margin-top: auto;
          padding: 1rem 1.5rem;
          border-top: 1px solid #f0f0f0;
          font-size: 0.8rem;
          color: #666;
        }

        .main-content {
          flex: 1;
          overflow: auto;
          position: relative;
        }

        .floating-chat-fab {
          position: fixed;
          right: 24px;
          bottom: 24px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: none;
          background: #2563eb;
          color: white;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .floating-chat-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 15px 35px rgba(37, 99, 235, 0.4);
        }

        .floating-chat-fab:active {
          transform: scale(0.95);
        }

        .floating-chat-fab svg {
          width: 28px;
          height: 28px;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            width: 280px;
            z-index: 1000;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
          }

          .sidebar.closed {
            transform: translateX(-100%);
            width: 280px;
            overflow: visible;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
          }

          .app-container {
            flex-direction: column;
          }

          .main-content {
            flex: 1;
            width: 100%;
            overflow: auto;
          }

          .sidebar-nav {
            padding: 0.75rem;
            gap: 0.25rem;
          }

          .nav-item {
            font-size: 0.9rem;
            padding: 0.75rem 0.85rem;
          }

          .sidebar-header {
            padding: 1.25rem;
          }

          .logo {
            font-size: 1.1rem;
          }
        }

        @media (max-width: 640px) {
          .sidebar {
            width: 75vw;
            max-width: 280px;
          }

          .sidebar.closed {
            transform: translateX(-100%);
          }

          .app-container {
            overflow: hidden;
          }

          .sidebar-header {
            padding: 1rem;
          }

          .sidebar-nav {
            padding: 0.5rem;
            gap: 0.25rem;
          }

          .nav-item {
            font-size: 0.85rem;
            padding: 0.7rem 0.75rem;
            gap: 0.5rem;
          }

          .logo {
            font-size: 1rem;
          }

          .floating-chat-fab {
            right: 16px;
            bottom: 16px;
            width: 56px;
            height: 56px;
          }

          .floating-chat-fab svg {
            width: 24px;
            height: 24px;
          }
        }
      `}</style>
    </div>
  );
};

export default App;

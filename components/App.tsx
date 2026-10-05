'use client';

import React, { useCallback, useEffect, useState } from 'react';
import AdvancedConversationalChat from './AdvancedConversationalChat';
import MaterialEstimator from './MaterialEstimator';
import Progressiveonboarding from './Progressiveonboarding';
import AuthForm from './AuthForm';
import { businessProfileManager } from '../lib/businessProfile';
import { firebaseBackend } from '../lib/firebaseBackend';
import { AIQuoteBuilder } from './AIQuoteBuilder';
import { AINoteEditor } from './AINoteEditor';
import { AIEmailComposer } from './AIEmailComposer';
import { SettingsHub } from './SettingsHub';

type ViewType =
  | 'chat'
  | 'quotes'
  | 'notes'
  | 'email'
  | 'materials'
  | 'settings'
  | 'onboarding';

interface AppProps {
  userId?: string;
}

const NAV_ITEMS: Array<{ id: ViewType; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: '✦' },
  { id: 'quotes', label: 'Quotes', icon: '▤' },
  { id: 'notes', label: 'Notes', icon: '✎' },
  { id: 'email', label: 'Email drafts', icon: '✉' },
  { id: 'materials', label: 'Materials', icon: '⌂' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export const App: React.FC<AppProps> = ({ userId = 'default-user' }) => {
  const [currentView, setCurrentView] = useState<ViewType>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState('business');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadProfile = useCallback((targetUserId: string) => {
    const profile = businessProfileManager.loadProfile(targetUserId);
    if (!profile) {
      setCurrentView('onboarding');
      return;
    }

    setBusinessType(profile.businessType || 'business');
    setCurrentView('chat');
  }, []);

  const hydrate = useCallback(async () => {
    try {
      await firebaseBackend.initialize();
      const currentUser = firebaseBackend.getCurrentUser();

      if (currentUser) {
        setIsAuthenticated(true);
        loadProfile(currentUser.uid);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error hydrating app:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleAuthSuccess = useCallback(async () => {
    setIsLoading(true);
    await hydrate();
  }, [hydrate]);

  const handleOnboardingComplete = useCallback(
    (data: any) => {
      const targetUserId = firebaseBackend.getCurrentUser()?.uid || userId;

      const businessName =
        data?.businessName ||
        data?.responses?.businessName ||
        data?.responses?.[1] ||
        'My Workspace';

      const nextBusinessType =
        data?.businessType ||
        data?.responses?.businessType ||
        data?.responses?.[2] ||
        'business';

      try {
        const existingProfile = businessProfileManager.loadProfile(targetUserId);
        if (existingProfile) {
          businessProfileManager.updateProfile(targetUserId, {
            businessName,
            businessType: nextBusinessType as any,
          });
        } else {
          businessProfileManager.createProfile(
            targetUserId,
            businessName,
            nextBusinessType as any,
            data?.email || 'owner@business.local'
          );
        }
      } catch (error) {
        console.error('Error saving local profile:', error);
      }

      setBusinessType(nextBusinessType);
      setCurrentView('chat');
    },
    [userId]
  );

  const handleLogout = async () => {
    try {
      await firebaseBackend.logout();
    } finally {
      window.location.href = '/';
    }
  };

  if (isLoading || isAuthenticated === null) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">✦</div>
        <div className="boot-text">Life&apos;s Assistant</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  if (currentView === 'onboarding') {
    return (
      <Progressiveonboarding
        userId={firebaseBackend.getCurrentUser()?.uid || userId}
        onComplete={handleOnboardingComplete}
      />
    );
  }

  const effectiveUserId = firebaseBackend.getCurrentUser()?.uid || userId;

  return (
    <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">✦</div>
          <div>
            <div className="brand-title">Life&apos;s Assistant</div>
            <div className="brand-subtitle">Personal AI workspace</div>
          </div>
        </div>

        <button className="new-chat" onClick={() => setCurrentView('chat')}>
          <span>＋</span>
          New chat
        </button>

        <nav>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentView(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="account-card">
          <div className="account-avatar">
            {(firebaseBackend.getCurrentUser()?.displayName || firebaseBackend.getCurrentUser()?.email || 'U')
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="account-copy">
            <div className="account-name">
              {firebaseBackend.getCurrentUser()?.displayName || 'Your account'}
            </div>
            <div className="account-email">
              {firebaseBackend.getCurrentUser()?.email || ''}
            </div>
          </div>
        </div>

        <button className="logout-btn" onClick={handleLogout}>Sign out</button>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className="topbar-title">Life&apos;s Assistant</div>
          <div className="beta-pill">Beta</div>
        </header>

        <section className="content">
          {currentView === 'chat' && (
            <AdvancedConversationalChat
              userId={effectiveUserId}
              fullScreen
              businessContext={businessType}
            />
          )}
          {currentView === 'quotes' && <AIQuoteBuilder userId={effectiveUserId} />}
          {currentView === 'notes' && <AINoteEditor userId={effectiveUserId} />}
          {currentView === 'email' && <AIEmailComposer userId={effectiveUserId} />}
          {currentView === 'materials' && <MaterialEstimator userId={effectiveUserId} />}
          {currentView === 'settings' && <SettingsHub userId={effectiveUserId} />}
        </section>
      </main>

      <style jsx>{`
        .boot-screen {
          min-height: 100vh;
          display: grid;
          place-content: center;
          gap: 0.75rem;
          text-align: center;
          background: #212121;
          color: #f4f4f4;
        }

        .boot-mark {
          font-size: 2rem;
        }

        .boot-text {
          font-size: 1rem;
          color: #b4b4b4;
        }

        .shell {
          min-height: 100vh;
          display: flex;
          background: #212121;
          color: #ececec;
        }

        .sidebar {
          width: 260px;
          min-width: 260px;
          height: 100vh;
          background: #171717;
          border-right: 1px solid #2f2f2f;
          display: flex;
          flex-direction: column;
          padding: 0.8rem;
          position: relative;
          z-index: 30;
        }

        .brand {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          padding: 0.55rem 0.45rem 1rem;
        }

        .brand-mark {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #2f2f2f;
          color: #ffffff;
          font-size: 1rem;
        }

        .brand-title {
          font-weight: 650;
          font-size: 0.95rem;
          color: #f7f7f7;
        }

        .brand-subtitle {
          color: #8e8e8e;
          font-size: 0.72rem;
          margin-top: 0.12rem;
        }

        .new-chat,
        .nav-item,
        .logout-btn {
          width: 100%;
          border: 0;
          background: transparent;
          color: #d8d8d8;
          border-radius: 9px;
          cursor: pointer;
          text-align: left;
          min-height: 42px;
        }

        .new-chat {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.65rem 0.75rem;
          border: 1px solid #333;
          margin-bottom: 0.75rem;
          background: #212121;
        }

        .new-chat:hover,
        .nav-item:hover,
        .logout-btn:hover {
          background: #2a2a2a;
        }

        nav {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.6rem 0.7rem;
          font-size: 0.9rem;
        }

        .nav-item.active {
          background: #2f2f2f;
          color: #fff;
        }

        .nav-icon {
          width: 20px;
          display: inline-grid;
          place-items: center;
          color: #a7a7a7;
        }

        .sidebar-spacer {
          flex: 1;
        }

        .account-card {
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.65rem 0.55rem;
          border-top: 1px solid #2f2f2f;
          margin-top: 0.7rem;
        }

        .account-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #3a3a3a;
          font-size: 0.85rem;
          font-weight: 700;
        }

        .account-copy {
          min-width: 0;
        }

        .account-name {
          font-size: 0.84rem;
          color: #f0f0f0;
        }

        .account-email {
          font-size: 0.68rem;
          color: #858585;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 155px;
        }

        .logout-btn {
          padding: 0.55rem 0.7rem;
          color: #9b9b9b;
          font-size: 0.82rem;
        }

        .main {
          min-width: 0;
          flex: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #212121;
        }

        .topbar {
          height: 54px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          padding: 0 1rem;
          border-bottom: 1px solid #2f2f2f;
          background: rgba(33,33,33,0.94);
          backdrop-filter: blur(12px);
          gap: 0.7rem;
        }

        .menu-btn {
          display: none;
          border: 0;
          background: transparent;
          color: #d6d6d6;
          font-size: 1.15rem;
          width: 38px;
          height: 38px;
          border-radius: 8px;
        }

        .topbar-title {
          font-size: 0.9rem;
          font-weight: 600;
        }

        .beta-pill {
          margin-left: auto;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          border: 1px solid #3b3b3b;
          color: #9f9f9f;
          font-size: 0.68rem;
        }

        .content {
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .scrim {
          display: none;
        }

        @media (max-width: 800px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-101%);
            transition: transform 180ms ease;
            box-shadow: 12px 0 30px rgba(0,0,0,0.35);
          }

          .sidebar.open {
            transform: translateX(0);
          }

          .menu-btn {
            display: grid;
            place-items: center;
          }

          .scrim {
            display: block;
            position: fixed;
            inset: 0;
            border: 0;
            background: rgba(0,0,0,0.5);
            z-index: 20;
          }
        }
      `}</style>
    </div>
  );
};

export default App;

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TasksView } from './TasksView';
import LifeAssistantHome from './LifeAssistantHome';
import SystemCheck from './SystemCheck';
import ActionLedger from './ActionLedger';
import MemoryCenter from './MemoryCenter';
import FocusBrief from './FocusBrief';
import WorkspaceSearch from './WorkspaceSearch';
import PeopleCenter from './PeopleCenter';
import ProjectsCenter from './ProjectsCenter';
import GlobalRadarScanner from './GlobalRadarScanner';
import RadarCenter from './RadarCenter';
import type { OpenLoop } from '../lib/firebaseBackend';

type ViewType =
  | 'home'
  | 'radar'
  | 'chat'
  | 'tasks'
  | 'quotes'
  | 'notes'
  | 'email'
  | 'materials'
  | 'settings'
  | 'system'
  | 'receipts'
  | 'memory'
  | 'brief'
  | 'search'
  | 'people'
  | 'projects'
  | 'onboarding';

interface AppProps {
  userId?: string;
}

const ASSISTANT_ITEMS: Array<{ id: ViewType; label: string; icon: string }> = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'radar', label: 'Life Radar', icon: '◌' },
  { id: 'search', label: 'Search', icon: '⌕' },
  { id: 'people', label: 'People', icon: '◎' },
  { id: 'projects', label: 'Projects', icon: '▦' },
  { id: 'brief', label: 'Focus Brief', icon: '◈' },
  { id: 'chat', label: 'Chat', icon: '✦' },
  { id: 'memory', label: 'Memory', icon: '◉' },
  { id: 'tasks', label: 'Tasks', icon: '✓' },
  { id: 'receipts', label: 'Receipts', icon: '◎' },
  { id: 'system', label: 'System Check', icon: '◇' },
];

const WORKSPACE_ITEMS: Array<{ id: ViewType; label: string; icon: string }> = [
  { id: 'quotes', label: 'Quotes', icon: '▤' },
  { id: 'notes', label: 'Notes', icon: '✎' },
  { id: 'email', label: 'Email drafts', icon: '↗' },
  { id: 'materials', label: 'Materials', icon: '◇' },
];

const VIEW_LABELS: Partial<Record<ViewType, string>> = {
  radar: 'Life Radar',
  chat: 'Conversation',
  tasks: 'Task center',
  quotes: 'Quote builder',
  notes: 'Notes',
  email: 'Email drafts',
  materials: 'Materials',
  receipts: 'Action ledger',
  memory: 'Memory',
  brief: 'Focus brief',
  search: 'Workspace search',
  people: 'People',
  projects: 'Projects',
};

function detectDevice(): 'desktop' | 'tablet' | 'phone' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const width = window.innerWidth;
  if (width <= 640) return 'phone';
  if (width <= 1024) return 'tablet';
  return 'desktop';
}

export const App: React.FC<AppProps> = ({ userId = 'default-user' }) => {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState('business');
  const [businessName, setBusinessName] = useState('My Workspace');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [radarCount, setRadarCount] = useState(0);

  const currentUser = firebaseBackend.getCurrentUser();

  const loadProfile = useCallback(async (targetUserId: string) => {
    try {
      const cloudProfile = await firebaseBackend.getLatestDraft('workspace-profile');
      if (cloudProfile?.businessName) {
        const nextBusinessName = String(cloudProfile.businessName);
        const nextBusinessType = String(cloudProfile.businessType || 'business');

        setBusinessType(nextBusinessType);
        setBusinessName(nextBusinessName);

        const localProfile = businessProfileManager.loadProfile(targetUserId);
        if (localProfile) {
          businessProfileManager.updateProfile(targetUserId, {
            businessName: nextBusinessName,
            businessType: nextBusinessType as any,
          });
        } else {
          businessProfileManager.createProfile(
            targetUserId,
            nextBusinessName,
            nextBusinessType as any,
            firebaseBackend.getCurrentUser()?.email || 'owner@business.local'
          );
        }

        setCurrentView('home');
        return;
      }
    } catch (error) {
      console.warn('Cloud workspace profile unavailable, checking local fallback:', error);
    }

    const profile = businessProfileManager.loadProfile(targetUserId);
    if (!profile) {
      setCurrentView('onboarding');
      return;
    }

    setBusinessType(profile.businessType || 'business');
    setBusinessName(profile.businessName || 'My Workspace');
    setCurrentView('home');
  }, []);

  const hydrate = useCallback(async () => {
    try {
      await firebaseBackend.initialize();
      const user = firebaseBackend.getCurrentUser();

      if (user) {
        setIsAuthenticated(true);
        await loadProfile(user.uid);
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

  useEffect(() => {
    if (!isAuthenticated) {
      setRadarCount(0);
      return;
    }

    let mounted = true;
    let unsubscribe = () => {};

    const updateCount = (loops: OpenLoop[]) => {
      if (!mounted) return;
      const now = Date.now();
      setRadarCount(
        loops.filter((loop) => {
          if (loop.status === 'resolved') return false;
          if (
            loop.status === 'snoozed' &&
            loop.snoozedUntil &&
            loop.snoozedUntil > now
          ) {
            return false;
          }
          return true;
        }).length
      );
    };

    const connect = async () => {
      try {
        await firebaseBackend.initialize();
        updateCount(await firebaseBackend.getOpenLoops(50));
        unsubscribe = firebaseBackend.onOpenLoopsChange(updateCount);
      } catch (error) {
        console.warn('Could not subscribe to Life Radar count:', error);
      }
    };

    void connect();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [isAuthenticated, currentUser?.uid]);

  const handleAuthSuccess = useCallback(async () => {
    setIsLoading(true);
    await hydrate();
  }, [hydrate]);

  const navigate = useCallback((view: string) => {
    const nextView = view as ViewType;
    setCurrentView(nextView);
    setSidebarOpen(false);

    const label = VIEW_LABELS[nextView];
    if (label) {
      void firebaseBackend
        .saveContinuityState({
          view: nextView,
          label,
          device: detectDevice(),
        })
        .catch((error) => {
          console.warn('Could not sync continuity state:', error);
        });
    }
  }, []);

  useEffect(() => {
    const openQuote = () => navigate('quotes');
    const openEmail = () => navigate('email');
    const openTasks = () => navigate('tasks');

    window.addEventListener('open-quote-builder', openQuote);
    window.addEventListener('open-email', openEmail);
    window.addEventListener('open-tasks', openTasks);

    return () => {
      window.removeEventListener('open-quote-builder', openQuote);
      window.removeEventListener('open-email', openEmail);
      window.removeEventListener('open-tasks', openTasks);
    };
  }, [navigate]);

  const handleOnboardingComplete = useCallback(
    async (data: any) => {
      const targetUserId = firebaseBackend.getCurrentUser()?.uid || userId;
      const nextBusinessName =
        data?.businessName || data?.responses?.businessName || data?.responses?.[1] || 'My Workspace';
      const nextBusinessType =
        data?.businessType || data?.responses?.businessType || data?.responses?.[2] || 'business';

      try {
        const existingProfile = businessProfileManager.loadProfile(targetUserId);
        if (existingProfile) {
          businessProfileManager.updateProfile(targetUserId, {
            businessName: nextBusinessName,
            businessType: nextBusinessType as any,
          });
        } else {
          businessProfileManager.createProfile(
            targetUserId,
            nextBusinessName,
            nextBusinessType as any,
            data?.email || 'owner@business.local'
          );
        }
      } catch (error) {
        console.error('Error saving local profile:', error);
      }

      try {
        await firebaseBackend.saveDraft('workspace-profile', {
          businessName: nextBusinessName,
          businessType: nextBusinessType,
          updatedAt: Date.now(),
        });
      } catch (error) {
        console.warn('Could not sync workspace profile to cloud:', error);
      }

      setBusinessType(nextBusinessType);
      setBusinessName(nextBusinessName);
      setCurrentView('home');
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

  const activeLabel = useMemo(() => {
    return [...ASSISTANT_ITEMS, ...WORKSPACE_ITEMS, { id: 'settings' as ViewType, label: 'Settings', icon: '⚙' }]
      .find((item) => item.id === currentView)?.label || "Life's Assistant";
  }, [currentView]);

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
    <>
      <GlobalRadarScanner userId={effectiveUserId} />
      <div className="shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="brand" onClick={() => navigate('home')} aria-label="Life's Assistant home">
          <div className="brand-mark">✦</div>
          <div className="brand-copy">
            <div className="brand-title">Life&apos;s Assistant</div>
            <div className="brand-subtitle">Personal AI workspace</div>
          </div>
        </button>

        <button
          className="new-chat"
          onClick={() => {
            navigate('chat');
            window.setTimeout(() => window.dispatchEvent(new CustomEvent('new-conversation')), 0);
          }}
        >
          <span className="new-chat-icon">＋</span>
          <span>New conversation</span>
        </button>

        <div className="nav-section">
          <div className="section-label">ASSISTANT</div>
          {ASSISTANT_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => navigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'radar' && radarCount > 0 && (
                <span className="radar-badge">{radarCount > 99 ? '99+' : radarCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="nav-section">
          <button className="section-toggle" onClick={() => setWorkspaceOpen((open) => !open)}>
            <span>WORKSPACE</span>
            <span className={`chevron ${workspaceOpen ? 'open' : ''}`}>›</span>
          </button>
          {workspaceOpen && (
            <div className="submenu">
              {WORKSPACE_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item submenu-item ${currentView === item.id ? 'active' : ''}`}
                  onClick={() => navigate(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-spacer" />

        <div className="nav-section account-section">
          <button
            className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
          >
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </button>
        </div>

        <div className="account-card">
          <div className="account-avatar">
            {(currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="account-copy">
            <div className="account-name">{currentUser?.displayName || 'Your account'}</div>
            <div className="account-email">{currentUser?.email || ''}</div>
          </div>
          <span className="account-state" title="Signed in" />
        </div>

        <button className="logout-btn" onClick={handleLogout}>Sign out</button>
      </aside>

      {sidebarOpen && (
        <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />
      )}

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="topbar-copy">
            <div className="topbar-title">{activeLabel}</div>
            <div className="topbar-subtitle">{businessName}</div>
          </div>
          <div className="beta-pill"><span /> Release candidate</div>
        </header>

        <section className="content">
          {currentView === 'home' && (
            <LifeAssistantHome
              displayName={currentUser?.displayName || undefined}
              businessName={businessName}
              userId={effectiveUserId}
              onNavigate={navigate}
            />
          )}
          {currentView === 'radar' && (
            <RadarCenter userId={effectiveUserId} onNavigate={navigate} />
          )}
          {currentView === 'chat' && (
            <AdvancedConversationalChat
              userId={effectiveUserId}
              fullScreen
              businessContext={`${businessName} · ${businessType}`}
            />
          )}
          {currentView === 'tasks' && <TasksView userId={effectiveUserId} />}
          {currentView === 'quotes' && <AIQuoteBuilder userId={effectiveUserId} />}
          {currentView === 'notes' && <AINoteEditor userId={effectiveUserId} />}
          {currentView === 'email' && <AIEmailComposer userId={effectiveUserId} />}
          {currentView === 'materials' && <MaterialEstimator userId={effectiveUserId} />}
          {currentView === 'settings' && <SettingsHub userId={effectiveUserId} />}
          {currentView === 'system' && <SystemCheck />}
          {currentView === 'receipts' && <ActionLedger />}
          {currentView === 'memory' && <MemoryCenter />}
          {currentView === 'brief' && <FocusBrief />}
          {currentView === 'search' && <WorkspaceSearch onNavigate={navigate} />}
          {currentView === 'people' && <PeopleCenter />}
          {currentView === 'projects' && <ProjectsCenter />}
        </section>
      </main>

      <style jsx>{`
        .boot-screen {
          min-height: 100vh;
          display: grid;
          place-content: center;
          gap: .75rem;
          text-align: center;
          background: #202020;
          color: #f4f4f4;
        }
        .boot-mark { font-size: 2rem; }
        .boot-text { font-size: .92rem; color: #8e8e8e; }
        .shell {
          min-height: 100vh;
          display: flex;
          background: #212121;
          color: #ececec;
        }
        .sidebar {
          width: 270px;
          min-width: 270px;
          height: 100vh;
          background: #171717;
          border-right: 1px solid #2a2a2a;
          display: flex;
          flex-direction: column;
          padding: 10px;
          position: relative;
          z-index: 30;
        }
        .brand {
          border: 0;
          background: transparent;
          color: inherit;
          width: 100%;
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 8px 7px 14px;
          text-align: left;
          cursor: pointer;
        }
        .brand-mark {
          width: 36px;
          height: 36px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #efefef;
          color: #111;
          font-size: 1rem;
          box-shadow: 0 6px 18px rgba(0,0,0,.18);
        }
        .brand-copy { min-width: 0; }
        .brand-title { font-weight: 680; font-size: .92rem; color: #f5f5f5; }
        .brand-subtitle { color: #707070; font-size: .69rem; margin-top: 2px; }
        .new-chat, .nav-item, .logout-btn, .section-toggle {
          width: 100%;
          border: 0;
          background: transparent;
          color: #cfcfcf;
          border-radius: 9px;
          cursor: pointer;
          text-align: left;
        }
        .new-chat {
          min-height: 43px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 10px;
          border: 1px solid #303030;
          margin-bottom: 13px;
          background: #202020;
          font-size: .82rem;
        }
        .new-chat-icon {
          width: 22px;
          height: 22px;
          border-radius: 7px;
          display: grid;
          place-items: center;
          background: #2d2d2d;
          color: #d8d8d8;
        }
        .new-chat:hover, .nav-item:hover, .logout-btn:hover { background: #252525; }
        .nav-section { margin-top: 5px; }
        .section-label, .section-toggle {
          min-height: 28px;
          display: flex;
          align-items: center;
          padding: 0 8px;
          color: #626262;
          letter-spacing: .11em;
          font-size: .61rem;
          font-weight: 700;
        }
        .section-toggle { justify-content: space-between; }
        .chevron { font-size: 1rem; transform: rotate(0deg); transition: transform .15s ease; }
        .chevron.open { transform: rotate(90deg); }
        .submenu { display: grid; gap: 1px; }
        .nav-item {
          min-height: 39px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0 9px;
          font-size: .82rem;
        }
        .nav-item.active { background: #2a2a2a; color: #fff; }
        .submenu-item { color: #aaa; }
        .nav-icon {
          width: 21px;
          display: inline-grid;
          place-items: center;
          color: #8a8a8a;
          font-size: .8rem;
        }
        .nav-item.active .nav-icon { color: #e8e8e8; }
        .radar-badge {
          margin-left: auto;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          border-radius: 999px;
          display: inline-grid;
          place-items: center;
          background: #5d4932;
          color: #ead7ae;
          font-size: .57rem;
          font-weight: 800;
        }
        .sidebar-spacer { flex: 1; }
        .account-section { border-top: 1px solid #292929; padding-top: 6px; }
        .account-card {
          display: grid;
          grid-template-columns: 34px minmax(0, 1fr) 8px;
          align-items: center;
          gap: 9px;
          padding: 9px 7px 5px;
          margin-top: 5px;
        }
        .account-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #353535;
          font-size: .8rem;
          font-weight: 700;
        }
        .account-copy { min-width: 0; }
        .account-name { font-size: .78rem; color: #e1e1e1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .account-email { font-size: .65rem; color: #686868; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .account-state { width: 7px; height: 7px; border-radius: 50%; background: #63d297; }
        .logout-btn { min-height: 34px; padding: 0 9px; color: #727272; font-size: .72rem; }
        .main {
          min-width: 0;
          flex: 1;
          height: 100vh;
          display: flex;
          flex-direction: column;
          background: #212121;
        }
        .topbar {
          height: 56px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          padding: 0 16px;
          border-bottom: 1px solid #2e2e2e;
          background: rgba(33,33,33,.96);
          backdrop-filter: blur(14px);
          gap: 10px;
        }
        .menu-btn {
          display: none;
          border: 0;
          background: transparent;
          color: #d6d6d6;
          font-size: 1rem;
          width: 38px;
          height: 38px;
          border-radius: 9px;
          cursor: pointer;
        }
        .topbar-copy { min-width: 0; }
        .topbar-title { font-size: .82rem; font-weight: 650; }
        .topbar-subtitle { color: #6f6f6f; font-size: .64rem; margin-top: 1px; }
        .beta-pill {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #363636;
          color: #898989;
          font-size: .66rem;
        }
        .beta-pill span { width: 6px; height: 6px; border-radius: 50%; background: #63d297; }
        .content { flex: 1; min-height: 0; overflow: hidden; position: relative; }
        .scrim { display: none; }
        @media (max-width: 820px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            transform: translateX(-101%);
            transition: transform 180ms ease;
            box-shadow: 12px 0 30px rgba(0,0,0,.4);
          }
          .sidebar.open { transform: translateX(0); }
          .menu-btn { display: grid; place-items: center; }
          .scrim {
            display: block;
            position: fixed;
            inset: 0;
            border: 0;
            background: rgba(0,0,0,.55);
            z-index: 20;
          }
        }
      `}</style>
      </div>
    </>
  );
};

export default App;

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend, type OpenLoop } from '../lib/firebaseBackend';
import LifeRadarPanel from './LifeRadarPanel';
import { DEFAULT_LIFE_PREFERENCES, MODE_TOOL_ORDER, MODE_PLACEHOLDERS, TRY_ASKING_BY_MODE, getVisibleTools, normalizeLifePreferences, scoreRadarItem, type LifePreferences } from '../lib/lifePreferences';

interface LifeAssistantHomeProps {
  displayName?: string;
  businessName?: string;
  userId: string;
  onNavigate: (view: string) => void;
}

type RecentItem = {
  id: string;
  kind: string;
  title: string;
  createdAt: number;
};

const QUICK_ACTIONS = [
  { id: 'radar', icon: '◌', title: 'Life Radar', detail: 'See the next items that need attention.' },
  { id: 'chat', icon: '✦', title: 'Tell Life’s Assistant', detail: 'Plan, write, or tell it what happened.' },
  { id: 'tasks', icon: '✓', title: 'Tasks', detail: 'Keep next steps simple and visible.' },
  { id: 'memory', icon: '◉', title: 'Memory', detail: 'Keep useful context you chose to save.' },
  { id: 'people', icon: '◎', title: 'People', detail: 'Save context about family, coworkers, and clients.' },
  { id: 'brief', icon: '◈', title: 'Focus Brief', detail: 'Turn saved work into the next three moves.' },
  { id: 'search', icon: '⌕', title: 'Search', detail: 'Find saved tasks, notes, people, and conversations.' },
  { id: 'quotes', icon: '▤', title: 'Build a quote', detail: 'Turn scope, labor, and materials into a draft.' },
  { id: 'email', icon: '↗', title: 'Email drafts', detail: 'Write a message for your approval.' },
];

export default function LifeAssistantHome({
  displayName,
  businessName,
  userId,
  onNavigate,
}: LifeAssistantHomeProps) {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = (displayName || 'there').split(' ')[0];
  const [command, setCommand] = useState('');
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [recentStatus, setRecentStatus] = useState('Loading your workspace…');
  const [todayLoops, setTodayLoops] = useState<OpenLoop[]>([]);
  const [openTaskCount, setOpenTaskCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<LifePreferences>(DEFAULT_LIFE_PREFERENCES);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [stored, cloud, lifeProfile] = await Promise.all([
          Promise.resolve(localStorage.getItem(`lifes-assistant-preferences:${userId}`)),
          firebaseBackend.getLatestDraft('assistant-preferences'),
          firebaseBackend.getUserProfile(userId),
        ]);
        const local = stored ? JSON.parse(stored) as unknown : null;
        const source = lifeProfile || (cloud && ('mode' in cloud || 'primary_slips' in cloud) ? cloud : local);
        if (active) setPreferences(normalizeLifePreferences(source));
      } catch (error) {
        console.warn('Could not load Life profile preferences:', error);
        if (active) setPreferences(DEFAULT_LIFE_PREFERENCES);
      }
    };
    void load();
    return () => { active = false; };
  }, [userId]);

  const orderedActions = useMemo(() => {
    return getVisibleTools(preferences, QUICK_ACTIONS);
  }, [preferences.mode, preferences.tool_overrides]);
  const coreActions = orderedActions.filter((action) => MODE_TOOL_ORDER[preferences.mode].includes(action.id) || preferences.tool_overrides.pinned.includes(action.id));

  useEffect(() => {
    let active = true;

    const loadRecent = async () => {
      try {
        const records = await firebaseBackend.getRecentBusinessRecords(6);
        if (!active) return;

        const visibleRecords = records.filter((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          const type = String(data.type || record.kind || '').toLowerCase();
          const title = String(data.title || '').toLowerCase();
          const label = String(data.label || '').toUpperCase();

          return (
            type !== 'spatial' &&
            type !== 'spatial-workspace' &&
            !title.includes('room scan') &&
            !label.includes('SPATIAL')
          );
        });

        const mapped = visibleRecords.slice(0, 5).map((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          const kind = String(record.kind || 'workspace');
          const title =
            String(
              data.title ||
              data.clientName ||
              data.subject ||
              data.text ||
              data.projectDescription ||
              kind
            ).slice(0, 90);

          return {
            id: String(record.id || kind + '-' + record.createdAt),
            kind,
            title,
            createdAt: Number(record.createdAt || record.updatedAt || Date.now()),
          };
        });

        setRecentItems(mapped);
        setRecentStatus(mapped.length ? 'Synced from your workspace.' : 'Your workspace is ready for its first saved item.');
      } catch {
        if (!active) return;
        setRecentItems([]);
        setRecentStatus('Cloud history is unavailable right now.');
      }
    };

    loadRecent();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const loadToday = async () => {
      try {
        const [loops, records] = await Promise.all([
          firebaseBackend.getOpenLoops(40),
          firebaseBackend.getRecentBusinessRecords(120),
        ]);
        if (!active) return;
        const now = Date.now();
        setTodayLoops(
          loops.filter((loop) =>
            !loop.archived &&
            loop.status !== 'resolved' &&
            !(loop.status === 'snoozed' && loop.snoozedUntil && loop.snoozedUntil > now)
          )
        );
        setOpenTaskCount(
          records.filter((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            return String(record.kind || '') === 'task' && String(data.status || 'open') !== 'done';
          }).length
        );
      } catch {
        if (!active) return;
        setTodayLoops([]);
        setOpenTaskCount(null);
      }
    };
    void loadToday();
    const refresh = () => { void loadToday(); };
    window.addEventListener('life-workspace-changed', refresh);
    return () => {
      active = false;
      window.removeEventListener('life-workspace-changed', refresh);
    };
  }, [userId]);

  const topLoop = useMemo(() => {
    if (!todayLoops.length) return null;
    return [...todayLoops].sort((a, b) => scoreRadarItem(b, preferences) - scoreRadarItem(a, preferences))[0];
  }, [todayLoops, preferences]);
  const waitingCount = todayLoops.filter((loop) => loop.status === 'waiting').length;
  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    []
  );

  const launchCommand = () => {
    const prompt = command.trim();
    if (!prompt) return;

    localStorage.setItem('assistant_launch_prompt:' + userId, prompt);
    setCommand('');
    onNavigate('chat');
  };

  const openRecentItem = (item: RecentItem) => {
    const view = item.kind === 'quote'
      ? 'quotes'
      : item.kind === 'note'
        ? 'notes'
        : item.kind === 'task'
          ? 'tasks'
          : 'chat';

    if (view === 'chat') {
      localStorage.setItem('assistant_launch_prompt:' + userId, 'Continue: ' + item.title);
    }
    onNavigate(view);
  };

  const startPrompt = (prompt: string) => {
    localStorage.setItem('assistant_launch_prompt:' + userId, prompt);
    onNavigate('chat');
  };

  return (
    <div className="home-page">
      <div className="home-inner">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">YOUR PERSONAL AI WORKSPACE</div>
            <h1>{greeting}, {firstName}.</h1>
            <p>
              {preferences.mode === 'everyday'
                ? 'Keep personal plans, people, and everyday details in one calm place.'
                : preferences.mode === 'business'
                  ? 'Keep client work, quotes, follow-ups, and next steps moving.'
                  : 'Keep everyday life and business moving from one calm workspace.'}
            </p>
            <div className="hero-actions">
              <button className="primary" onClick={() => onNavigate('chat')}>Start a conversation</button>
              <button className="secondary" onClick={() => onNavigate('tasks')}>Open task center</button>
            </div>
            <div className="workspace-label">
              <span className="status-dot" />
              {businessName || 'Your workspace'} · Release candidate
            </div>
          </div>

          <aside className="hero-visual" aria-label="Today at a glance">
            <div className="today-head">
              <span className="section-kicker">TODAY</span>
              <span className="today-date">{todayLabel}</span>
            </div>

            {topLoop ? (
              <button className="today-top" onClick={() => onNavigate('radar')}>
                <span className="today-top-label">Handle first</span>
                <strong>{topLoop.title}</strong>
                <small>{topLoop.nextAction || topLoop.summary || 'Open Life Radar to see why this is up.'}</small>
                <span className="today-top-go">Open in Life Radar →</span>
              </button>
            ) : (
              <button className="today-top quiet" onClick={() => onNavigate('radar')}>
                <span className="today-top-label">Radar is clear</span>
                <strong>Nothing is slipping right now.</strong>
                <small>Life Radar watches quotes, follow-ups, drafts, and stalled projects for you.</small>
              </button>
            )}

            {todayLoops.length > 1 && topLoop ? (
              <div className="today-also">
                <span className="today-also-label">Also on your radar</span>
                {todayLoops.filter((loop) => loop.id !== topLoop.id).slice(0, 2).map((loop) => (
                  <button key={loop.id} onClick={() => onNavigate('radar')}>
                    <span className={'today-dot ' + loop.status} />
                    <span>{loop.title}</span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="today-stats">
              <button onClick={() => onNavigate('radar')}>
                <strong>{todayLoops.length}</strong>
                <span>need{todayLoops.length === 1 ? 's' : ''} attention</span>
              </button>
              <button onClick={() => onNavigate('radar')}>
                <strong>{waitingCount}</strong>
                <span>waiting on others</span>
              </button>
              <button onClick={() => onNavigate('tasks')}>
                <strong>{openTaskCount === null ? '–' : openTaskCount}</strong>
                <span>open task{openTaskCount === 1 ? '' : 's'}</span>
              </button>
            </div>

            <div className="visual-card">
              <div className="visual-icon">✦</div>
              <div>
                <strong>Assistant ready</strong>
                <span>Approval-first for external actions</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="command-center">
          <div className="command-copy">
            <span className="section-kicker">DO ANYTHING</span>
            <h2>Tell Life&apos;s Assistant the outcome you want.</h2>
            <p>Start with the goal. The assistant can turn it into a conversation, task, quote, note, email draft, or next action.</p>
          </div>
          <div className="command-box">
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') launchCommand();
              }}
              placeholder={MODE_PLACEHOLDERS[preferences.mode]}
              aria-label="Tell Life's Assistant what you want done"
            />
            <button onClick={launchCommand} disabled={!command.trim()}>Go</button>
          </div>
        </section>

        <LifeRadarPanel userId={userId} onNavigate={onNavigate} />

        <section className="today-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">CONTINUE</span>
              <h2>Your workspace, where you left it.</h2>
            </div>
            <span className="section-note">{recentStatus}</span>
          </div>
          <div className="recent-strip">
            {recentItems.length === 0 ? (
              <button className="recent-empty" onClick={() => onNavigate('chat')}>
                <span className="quick-icon">✦</span>
                <span><strong>Start with one thought</strong><small>Your saved work will begin appearing here.</small></span>
                <span className="arrow">→</span>
              </button>
            ) : recentItems.map((item, index) => (
              <button
                key={item.id}
                className={index === 0 ? 'recent-card featured' : 'recent-card'}
                onClick={() => openRecentItem(item)}
              >
                <span className="recent-kind">{item.kind.toUpperCase()}</span>
                <strong>{item.title}</strong>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="quick-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">TOOLS</span>
              <h2>What do you want to get done?</h2>
            </div>
            <span className="section-note">Everything stays tied to your account.</span>
          </div>

          <div className="quick-grid">
            {coreActions.map((action) => (
              <button key={action.id} className="quick-card" onClick={() => onNavigate(action.id)}>
                <span className="quick-icon">{action.icon}</span>
                <span className="quick-copy">
                  <strong>{action.title}</strong>
                  <small>{action.detail}</small>
                </span>
                <span className="arrow">↗</span>
              </button>
            ))}
          </div>
        </section>

        <section className="lower-grid">
          <div className="panel ask-panel">
            <div className="panel-heading">
              <span className="section-kicker">TRY ASKING</span>
              <h3>Start naturally. No commands required.</h3>
            </div>
            <div className="prompt-list">
              {TRY_ASKING_BY_MODE[preferences.mode].map((prompt) => (
                <button key={prompt} onClick={() => { localStorage.setItem('assistant_launch_prompt:' + userId, prompt); onNavigate('chat'); }}>
                  <span>“{prompt}”</span>
                  <span>→</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel focus-panel">
            <div className="panel-heading">
              <span className="section-kicker">TODAY&apos;S FOCUS</span>
              <h3>Three quick ways to move today forward.</h3>
            </div>
            <div className="focus-list">
              <button onClick={() => onNavigate('radar')}><span>1</span><strong>Check what needs attention</strong><small>Open Life Radar</small></button>
              {recentItems[0] && <button onClick={() => openRecentItem(recentItems[0])}><span>2</span><strong>Continue {recentItems[0].title}</strong><small>Pick up where you stopped</small></button>}
              <button onClick={() => startPrompt(TRY_ASKING_BY_MODE[preferences.mode][0])}><span>{recentItems[0] ? '3' : '2'}</span><strong>{TRY_ASKING_BY_MODE[preferences.mode][0]}</strong><small>Start in under 30 seconds</small></button>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .home-page {
          height: 100%;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          -webkit-overflow-scrolling: touch;
          scroll-padding-bottom: calc(110px + env(safe-area-inset-bottom));
          background:
            radial-gradient(circle at 78% 4%, rgba(96, 165, 250, 0.07), transparent 25%),
            #212121;
          color: #ececec;
        }
        .home-inner {
          width: min(1180px, calc(100% - 48px));
          margin: 0 auto;
          padding: 42px 0 64px;
        }
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(360px, .95fr);
          gap: 28px;
          align-items: stretch;
        }
        .hero-copy { padding: 44px 8px 36px 4px; }
        .eyebrow, .section-kicker {
          color: #8f8f8f;
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          font-weight: 700;
        }
        h1 {
          margin: 10px 0 14px;
          font-size: clamp(2.4rem, 5vw, 4.5rem);
          line-height: .98;
          letter-spacing: -0.055em;
          font-weight: 650;
        }
        .hero-copy > p {
          max-width: 650px;
          color: #aaa;
          font-size: 1rem;
          line-height: 1.7;
          margin: 0;
        }
        .hero-actions {
          display: flex;
          gap: 10px;
          margin-top: 24px;
          flex-wrap: wrap;
        }
        .primary, .secondary {
          border: 0;
          border-radius: 12px;
          min-height: 44px;
          padding: 0 16px;
          font-weight: 650;
          cursor: pointer;
        }
        .primary { background: #f2f2f2; color: #111; }
        .secondary { background: #2c2c2c; color: #e9e9e9; border: 1px solid #3b3b3b; }
        .workspace-label {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #7f7f7f;
          margin-top: 20px;
          font-size: .78rem;
        }
        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #63d297;
          box-shadow: 0 0 0 3px rgba(99, 210, 151, .09);
        }
        .hero-visual {
          min-height: 0;
          border-radius: 22px;
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px;
          border: 1px solid #343434;
          background:
            radial-gradient(120% 90% at 100% 0%, rgba(159,217,184,.12), transparent 55%),
            radial-gradient(90% 80% at 0% 100%, rgba(99,140,210,.10), transparent 60%),
            linear-gradient(180deg, #262626, #1f1f1f);
          box-shadow: 0 24px 70px rgba(0,0,0,.26);
        }
        .today-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .today-date { color: #8d8d8d; font-size: .72rem; }
        .today-top {
          text-align: left;
          display: grid;
          gap: 6px;
          padding: 15px 16px;
          border-radius: 16px;
          border: 1px solid #4a5a52;
          background: linear-gradient(135deg, #2b3a33, #262a28 70%);
          color: #f0f0f0;
          cursor: pointer;
          transition: transform .16s ease, border-color .16s ease;
        }
        .today-top:hover { transform: translateY(-1px); border-color: #6b8a7a; }
        .today-top.quiet { border-color: #3a3a3a; background: #262626; }
        .today-top-label { color: #9fd9b8; font-size: .6rem; letter-spacing: .14em; font-weight: 800; }
        .today-top.quiet .today-top-label { color: #8f8f8f; }
        .today-top strong {
          font-size: 1.02rem;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .today-top small {
          color: #9d9d9d;
          font-size: .74rem;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .today-top-go { color: #c3ead4; font-size: .72rem; font-weight: 700; margin-top: 2px; }
        .today-also { display: grid; gap: 4px; }
        .today-also-label { color: #7d7d7d; font-size: .6rem; letter-spacing: .12em; font-weight: 800; margin-bottom: 2px; }
        .today-also button {
          display: grid;
          grid-template-columns: 10px minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #cfcfcf;
          font-size: .78rem;
          text-align: left;
          cursor: pointer;
          white-space: nowrap;
          overflow: hidden;
        }
        .today-also button span:last-child { overflow: hidden; text-overflow: ellipsis; }
        .today-also button:hover { background: #2a2a2a; border-color: #3a3a3a; }
        .today-dot { width: 8px; height: 8px; border-radius: 50%; background: #9fd9b8; }
        .today-dot.waiting { background: #d9c27a; }
        .today-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }
        .today-stats button {
          display: grid;
          gap: 2px;
          padding: 11px 12px;
          border-radius: 13px;
          border: 1px solid #353535;
          background: #272727;
          color: #e6e6e6;
          text-align: left;
          cursor: pointer;
        }
        .today-stats button:hover { background: #2d2d2d; border-color: #444; }
        .today-stats strong { font-size: 1.25rem; line-height: 1.1; }
        .today-stats span { color: #8a8a8a; font-size: .66rem; line-height: 1.3; }
        .visual-card {
          margin-top: auto;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          border-radius: 14px;
          background: rgba(24,24,24,.86);
          border: 1px solid rgba(255,255,255,.11);
          backdrop-filter: blur(14px);
        }
        .visual-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #efefef;
          color: #111;
        }
        .visual-card strong, .visual-card span { display: block; }
        .visual-card strong { font-size: .86rem; }
        .visual-card span { color: #9a9a9a; font-size: .72rem; margin-top: 3px; }
        .command-center {
          margin-top: 22px;
          padding: 18px;
          display: grid;
          grid-template-columns: minmax(220px, .75fr) minmax(0, 1.25fr);
          gap: 18px;
          align-items: center;
          background: #181818;
          border: 1px solid #333;
          border-radius: 18px;
          box-shadow: 0 16px 40px rgba(0,0,0,.18);
        }
        .command-copy h2 {
          margin: 5px 0 6px;
          font-size: 1.05rem;
          letter-spacing: -.02em;
        }
        .command-copy p {
          margin: 0;
          color: #777;
          font-size: .7rem;
          line-height: 1.5;
        }
        .command-box {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 8px;
          padding: 7px;
          border: 1px solid #3b3b3b;
          border-radius: 14px;
          background: #242424;
        }
        .command-box input {
          min-width: 0;
          min-height: 44px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #efefef;
          padding: 0 8px;
        }
        .command-box input::placeholder { color: #666; }
        .command-box button {
          min-width: 54px;
          border: 0;
          border-radius: 10px;
          background: #ededed;
          color: #111;
          font-weight: 700;
          cursor: pointer;
        }
        .command-box button:disabled { opacity: .35; cursor: default; }
        .today-section { margin-top: 28px; }
        .recent-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0,1fr));
          gap: 8px;
        }
        .recent-card, .recent-empty {
          min-height: 116px;
          padding: 13px;
          border: 1px solid #343434;
          border-radius: 14px;
          background: #272727;
          color: #ddd;
          text-align: left;
          cursor: pointer;
        }
        .recent-card { display: flex; flex-direction: column; }
        .recent-card.featured {
          grid-column: span 2;
          border-color: #47524c;
          background: linear-gradient(135deg, #2b332f, #272727 62%);
        }
        .recent-card:hover, .recent-empty:hover { background: #2d2d2d; border-color: #414141; }
        .recent-kind {
          color: #707070;
          font-size: .56rem;
          letter-spacing: .12em;
          font-weight: 750;
        }
        .recent-card strong {
          margin-top: 9px;
          font-size: .72rem;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .recent-card small {
          margin-top: auto;
          padding-top: 10px;
          color: #626262;
          font-size: .58rem;
        }
        .recent-empty {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: auto minmax(0,1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .recent-empty strong, .recent-empty small { display: block; }
        .recent-empty strong { font-size: .76rem; }
        .recent-empty small { color: #737373; font-size: .64rem; margin-top: 3px; }
        .quick-section { margin-top: 36px; }
        .section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 15px;
        }
        .section-heading h2 {
          margin: 6px 0 0;
          font-size: 1.45rem;
          letter-spacing: -.025em;
        }
        .section-note { color: #777; font-size: .74rem; }
        .quick-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
          gap: 10px;
        }
        .quick-card {
          min-height: 142px;
          padding: 16px;
          text-align: left;
          color: #eee;
          background: #272727;
          border: 1px solid #343434;
          border-radius: 16px;
          cursor: pointer;
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 12px;
          align-items: start;
          transition: transform .16s ease, background .16s ease, border-color .16s ease;
        }
        .quick-card:hover {
          transform: translateY(-2px);
          background: #2c2c2c;
          border-color: #444;
        }
        .quick-icon {
          width: 33px;
          height: 33px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #333;
          color: #d8d8d8;
        }
        .quick-copy { min-width: 0; }
        .quick-copy strong, .quick-copy small { display: block; overflow-wrap: anywhere; }
        .quick-copy strong { font-size: .86rem; line-height: 1.3; }
        .quick-copy small {
          margin-top: 8px;
          color: #8f8f8f;
          line-height: 1.45;
          font-size: .73rem;
        }
        .arrow { color: #6e6e6e; font-size: .9rem; }
        .lower-grid {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 12px;
          margin-top: 12px;
        }
        .panel {
          background: #252525;
          border: 1px solid #333;
          border-radius: 17px;
          padding: 20px;
        }
        .panel-heading h3 { margin: 6px 0 16px; font-size: 1rem; }
        .prompt-list { display: grid; gap: 7px; }
        .prompt-list button {
          border: 0;
          border-radius: 10px;
          background: #2d2d2d;
          color: #bdbdbd;
          min-height: 44px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          text-align: left;
          cursor: pointer;
        }
        .prompt-list button:hover { background: #333; color: #ededed; }
        .focus-list { display: grid; gap: 8px; }
        .focus-list button {
          min-height: 58px;
          display: grid;
          grid-template-columns: 28px 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: 1px solid #353535;
          border-radius: 12px;
          background: #2b2b2b;
          color: #ededed;
          text-align: left;
          cursor: pointer;
        }
        .focus-list button:hover { background: #323232; border-color: #454545; }
        .focus-list button > span {
          width: 25px;
          height: 25px;
          display: grid;
          place-items: center;
          border-radius: 8px;
          background: #383838;
          color: #9fd9b8;
          font-size: .68rem;
          font-weight: 800;
        }
        .focus-list strong { font-size: .77rem; line-height: 1.3; }
        .focus-list small { color: #7f7f7f; font-size: .65rem; }
        @media (max-width: 1000px) {
          .hero { grid-template-columns: 1fr; }
          .hero-copy { padding-bottom: 0; }
          .hero-visual { min-height: 0; }
          .quick-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
          .recent-strip { grid-template-columns: repeat(2, 1fr); }
          .command-center { grid-template-columns: 1fr; }
        }
        @media (max-width: 680px) {
          .home-inner {
            width: min(100% - 28px, 1180px);
            padding-top: 24px;
            padding-bottom: calc(110px + env(safe-area-inset-bottom));
          }
          .hero-copy { padding-top: 16px; }
          .hero-visual { border-radius: 17px; padding: 14px; }
          .today-stats strong { font-size: 1.1rem; }
          .lower-grid, .recent-strip { grid-template-columns: 1fr; }
          .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .quick-card { min-height: 0; padding: 13px; grid-template-columns: auto minmax(0, 1fr); gap: 10px; }
          .quick-card .arrow { display: none; }
          .quick-copy strong { font-size: .8rem; }
          .quick-copy small { margin-top: 5px; font-size: .68rem; }
          .recent-card.featured { grid-column: auto; }
          .focus-list button { grid-template-columns: 28px 1fr; }
          .focus-list small { grid-column: 2; }
          .command-box { grid-template-columns: 1fr; }
          .command-box button { min-height: 42px; }
          .section-heading { align-items: start; flex-direction: column; }
          .section-note { display: none; }
          h1 { font-size: 2.45rem; }
        }
      `}</style>
    </div>
  );
}

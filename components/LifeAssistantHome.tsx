'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

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
  { id: 'chat', icon: '✦', title: "Ask Life's Assistant", detail: 'Plan, research, write, or think something through.' },
  { id: 'tasks', icon: '✓', title: 'Task center', detail: 'Review work that is queued, waiting, or ready.' },
  { id: 'quotes', icon: '▤', title: 'Build a quote', detail: 'Turn scope, labor, and materials into a clean draft.' },
  { id: 'email', icon: '↗', title: 'Draft an email', detail: 'Write a clear message without starting from a blank page.' },
];

const TRY_ASKING = [
  'Help me plan everything I need to get done tomorrow.',
  'Turn these rough notes into a professional quote.',
  'Draft a follow-up email and let me approve it before anything is sent.',
  'Break this project into steps and tell me what I should do first.',
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

  useEffect(() => {
    let active = true;

    const loadRecent = async () => {
      try {
        const records = await firebaseBackend.getRecentBusinessRecords(6);
        if (!active) return;

        const mapped = records.slice(0, 5).map((record) => {
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

  const launchCommand = () => {
    const prompt = command.trim();
    if (!prompt) return;

    localStorage.setItem('assistant_launch_prompt:' + userId, prompt);
    setCommand('');
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
              Keep your conversations, drafts, tasks, and business tools in one place.
              Life&apos;s Assistant is built to help you move work forward without making the app feel like work.
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

          <div className="hero-visual" role="img" aria-label="Professional working at a laptop">
            <div className="visual-overlay" />
            <div className="visual-card">
              <div className="visual-icon">✦</div>
              <div>
                <strong>Assistant ready</strong>
                <span>Approval-first for external actions</span>
              </div>
            </div>
            <div className="photo-credit">Photo via Unsplash</div>
          </div>
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
              placeholder="Example: Remind me to call Allen tomorrow and draft what I should say."
              aria-label="Tell Life's Assistant what you want done"
            />
            <button onClick={launchCommand} disabled={!command.trim()}>Go</button>
          </div>
        </section>

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
            ) : recentItems.map((item) => (
              <button
                key={item.id}
                className="recent-card"
                onClick={() => onNavigate(item.kind === 'quote' ? 'quotes' : item.kind === 'note' ? 'notes' : item.kind === 'task' ? 'tasks' : 'receipts')}
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
            {QUICK_ACTIONS.map((action) => (
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
              {TRY_ASKING.map((prompt) => (
                <button key={prompt} onClick={() => onNavigate('chat')}>
                  <span>“{prompt}”</span>
                  <span>→</span>
                </button>
              ))}
            </div>
          </div>

          <div className="panel status-panel">
            <div className="panel-heading">
              <span className="section-kicker">LIVE STATUS</span>
              <h3>What is real right now</h3>
            </div>

            <div className="status-row">
              <span className="status-icon ok">✓</span>
              <div>
                <strong>Separate user accounts</strong>
                <p>Allen can create his own sign-in and get his own workspace.</p>
              </div>
            </div>
            <div className="status-row">
              <span className="status-icon ok">✓</span>
              <div>
                <strong>Conversation storage</strong>
                <p>Firebase sync is configured for signed-in chat, with local fallback if Firestore access is restricted.</p>
              </div>
            </div>
            <div className="status-row">
              <span className="status-icon guard">◇</span>
              <div>
                <strong>Approval-first actions</strong>
                <p>Sending or changing things outside the app should require confirmation.</p>
              </div>
            </div>
            <div className="status-row">
              <span className="status-icon build">↻</span>
              <div>
                <strong>Persistent agent mode</strong>
                <p>Still being hardened so scheduled work can run even when the browser is closed.</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .home-page {
          height: 100%;
          overflow-y: auto;
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
          min-height: 390px;
          border-radius: 22px;
          overflow: hidden;
          position: relative;
          border: 1px solid #343434;
          background:
            linear-gradient(180deg, transparent 15%, rgba(17,17,17,.15) 55%, rgba(17,17,17,.82) 100%),
            url('https://images.unsplash.com/photo-1758873272345-40f377c21e7f?auto=format&fit=crop&fm=jpg&q=82&w=1600') center/cover no-repeat;
          box-shadow: 0 24px 70px rgba(0,0,0,.26);
        }
        .visual-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(46, 71, 110, .04), rgba(0,0,0,.08));
        }
        .visual-card {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 18px;
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
        .photo-credit {
          position: absolute;
          top: 10px;
          right: 12px;
          color: rgba(255,255,255,.56);
          font-size: .62rem;
          text-shadow: 0 1px 5px #000;
        }
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
        .quick-copy strong, .quick-copy small { display: block; }
        .quick-copy strong { font-size: .86rem; }
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
        .status-panel { display: flex; flex-direction: column; }
        .status-row {
          display: grid;
          grid-template-columns: 30px 1fr;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid #303030;
        }
        .status-icon {
          width: 27px;
          height: 27px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #303030;
          font-size: .75rem;
        }
        .status-icon.ok { color: #78d7a4; }
        .status-icon.guard { color: #8fc4ff; }
        .status-icon.build { color: #e6c477; }
        .status-row strong { font-size: .8rem; }
        .status-row p {
          margin: 3px 0 0;
          color: #858585;
          font-size: .72rem;
          line-height: 1.45;
        }
        @media (max-width: 1000px) {
          .hero { grid-template-columns: 1fr; }
          .hero-copy { padding-bottom: 0; }
          .hero-visual { min-height: 320px; }
          .quick-grid { grid-template-columns: repeat(2, 1fr); }
          .recent-strip { grid-template-columns: repeat(2, 1fr); }
          .command-center { grid-template-columns: 1fr; }
        }
        @media (max-width: 680px) {
          .home-inner { width: min(100% - 28px, 1180px); padding-top: 24px; }
          .hero-copy { padding-top: 16px; }
          .hero-visual { min-height: 280px; border-radius: 17px; }
          .quick-grid, .lower-grid, .recent-strip { grid-template-columns: 1fr; }
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

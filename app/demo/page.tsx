'use client';

import React, { useState } from 'react';

type Mode = 'everyday' | 'business';

const toolsByMode: Record<Mode, string[]> = {
  everyday: ['Life Radar', 'Chat', 'Tasks', 'People', 'Memory', 'Focus Brief', 'Search'],
  business: ['Life Radar', 'Build a quote', 'Email drafts', 'Tasks', 'People', 'Projects', 'Search'],
};

const promptsByMode: Record<Mode, string[]> = {
  everyday: ['What am I forgetting this week?', 'Help me plan tomorrow.', 'Remind me to renew my car registration.'],
  business: ['Turn these notes into a quote.', 'Follow up on an unfinished quote.', 'What should I do next on this project?'],
};

export default function PublicDemoPage() {
  const [mode, setMode] = useState<Mode>('everyday');
  const [activeTool, setActiveTool] = useState('Life Radar');
  const [selectedPrompt, setSelectedPrompt] = useState('');

  const tools = toolsByMode[mode];

  return (
    <main className="demo">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Life’s Assistant">
          <span className="brand-mark">✦</span>
          <span><strong>Life’s Assistant</strong><small>Personal AI workspace</small></span>
        </a>
        <div className="demo-tag"><span /> PREVIEW MODE</div>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Demo tools">
          {tools.map((tool, i) => (
            <button className={activeTool === tool ? 'nav-item selected' : 'nav-item'} key={tool} onClick={() => setActiveTool(tool)}>
              <span className="nav-icon">{['◌','✦','✓','◎','◉','◈','⌕','▤'][i % 8]}</span>{tool}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>Want your own private workspace?</p>
          <a href="/">Create an account <span>→</span></a>
        </div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">✦</span><strong>Life’s Assistant</strong></div>
          <div className="top-title">{activeTool}<small>Sample workspace</small></div>
          <span className="preview-pill"><i /> Read-only demo</span>
        </header>

        <div className="content">
          <div className="intro">
            <div>
              <div className="eyebrow">A CALMER WAY TO KEEP LIFE MOVING</div>
              <h1>Your life, with fewer loose ends.</h1>
              <p>See what needs attention, pick up where you left off, and turn the next step into something you can do.</p>
            </div>
            <div className="mode-card">
              <span className="eyebrow">EXPLORE A MODE</span>
              <div className="mode-toggle" role="group" aria-label="Choose demo mode">
                <button className={mode === 'everyday' ? 'active' : ''} onClick={() => { setMode('everyday'); setActiveTool('Life Radar'); }}>Everyday</button>
                <button className={mode === 'business' ? 'active' : ''} onClick={() => { setMode('business'); setActiveTool('Life Radar'); }}>Business</button>
              </div>
              <small>Switch modes to see the tools and suggestions change.</small>
            </div>
          </div>

          <div className="privacy-note"><span>✓</span><div><strong>Sample data only</strong><small>This public preview doesn’t connect to anyone’s account or show saved conversations.</small></div></div>

          <section className="radar">
            <div className="section-head">
              <div><div className="eyebrow">LIFE RADAR</div><h2>What needs your attention?</h2></div>
              <div className="open-count"><strong>{mode === 'business' ? '2' : '2'}</strong><small>open loops</small></div>
            </div>
            <article className="loop">
              <div className="loop-copy"><span className="waiting">WAITING · 3D</span><h3>{mode === 'business' ? 'Finish a quote for the kitchen refresh' : 'Reply to Jamie about Saturday'}</h3><p>{mode === 'business' ? 'The project notes are ready to turn into a clear estimate.' : 'Jamie is waiting on a time that works for you.'}</p><small>Next: {mode === 'business' ? 'Review the scope and add labor.' : 'Choose a time and send a reply.'}</small></div>
              <button className="handle" onClick={() => setActiveTool(mode === 'business' ? 'Build a quote' : 'Chat')}>Handle it <span>→</span></button>
            </article>
            <article className="loop secondary">
              <div className="loop-copy"><span className="open">OPEN · TODAY</span><h3>{mode === 'business' ? 'Confirm tomorrow’s site visit' : 'Pick up the groceries you listed'}</h3><p>{mode === 'business' ? 'A quick confirmation keeps the project moving.' : 'Your saved list is ready when you are.'}</p></div>
              <button className="text-action" onClick={() => setActiveTool('Tasks')}>View next step →</button>
            </article>
          </section>

          <section className="tools">
            <div className="section-head"><div><div className="eyebrow">YOUR TOOLS</div><h2>Start with what matters</h2></div><span className="mode-caption">{mode === 'business' ? 'Business mode' : 'Everyday mode'}</span></div>
            <div className="tool-grid">
              {tools.slice(0, 6).map((tool, i) => <button key={tool} onClick={() => setActiveTool(tool)} className="tool-card"><span className="tool-icon">{['◌','✦','✓','◎','◉','◈'][i % 6]}</span><strong>{tool}</strong><span className="arrow">↗</span></button>)}
            </div>
          </section>

          <section className="prompts">
            <div className="eyebrow">TRY ASKING</div>
            <h2>Just say what you need.</h2>
            <div className="prompt-list">{promptsByMode[mode].map((prompt) => <button key={prompt} className={selectedPrompt === prompt ? 'chosen' : ''} onClick={() => { setSelectedPrompt(prompt); setActiveTool('Chat'); }}>{prompt}<span>→</span></button>)}</div>
            {selectedPrompt && <p className="prompt-feedback">In the full app, this would start a conversation with: “{selectedPrompt}”</p>}
          </section>

          <footer><span>Life’s Assistant</span><span>Preview link · no account needed</span><a href="/">Open sign-in page →</a></footer>
        </div>
      </section>

      <style jsx>{`
        * { box-sizing: border-box; }
        .demo { min-height: 100vh; background: #141614; color: #f0f2ef; display: flex; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .sidebar { width: 248px; flex: 0 0 248px; background: #101210; border-right: 1px solid #292d29; padding: 22px 15px; display: flex; flex-direction: column; }
        .brand { display:flex; gap: 10px; align-items: center; color:inherit; text-decoration:none; padding: 2px 5px 25px; }
        .brand-mark { width: 35px; height: 35px; border-radius: 11px; display:grid; place-items:center; background:#e6e9e4; color:#171a17; font-size: 18px; }
        .brand strong,.brand small { display:block; }.brand strong { font-size:13px; letter-spacing:-.2px; }.brand small { color:#747c75; font-size:10px; margin-top:3px; }
        .demo-tag { background:#1c241e; border:1px solid #303c32; color:#a9c6ae; padding:9px 11px; border-radius:9px; font-size:9px; letter-spacing:.12em; font-weight:800; }
        .demo-tag span,.preview-pill i { display:inline-block; width:7px; height:7px; background:#72c58a; border-radius:50%; margin-right:7px; }
        .nav-label,.eyebrow { color:#777f78; font-size:9px; letter-spacing:.15em; font-weight:800; }
        .nav-label { margin:29px 8px 9px; }
        nav { display:grid; gap:3px; }.nav-item { border:0; background:transparent; color:#aeb4ae; display:flex; gap:10px; align-items:center; border-radius:8px; text-align:left; padding:10px 9px; font-size:12px; cursor:pointer; }.nav-item:hover,.nav-item.selected { background:#252925; color:#fff; }.nav-icon { width:18px; color:#89998b; text-align:center; }
        .sidebar-bottom { margin-top:auto; padding:14px 9px 3px; border-top:1px solid #292d29; }.sidebar-bottom p { color:#798078; font-size:10px; line-height:1.5; }.sidebar-bottom a { color:#d1e6d5; font-size:11px; text-decoration:none; font-weight:700; }.sidebar-bottom a span { margin-left:6px; }
        .main { min-width:0; flex:1; }.topbar { height:64px; border-bottom:1px solid #292d29; display:flex; align-items:center; padding:0 32px; gap:14px; position:sticky; top:0; background:rgba(20,22,20,.94); backdrop-filter:blur(12px); z-index:2; }.top-title { font-weight:700; font-size:13px; }.top-title small { display:block; color:#737a73; font-size:10px; font-weight:400; margin-top:3px; }.preview-pill { margin-left:auto; border:1px solid #343c35; border-radius:30px; color:#aeb8af; padding:7px 10px; font-size:10px; }.preview-pill i { width:6px; height:6px; }
        .mobile-brand { display:none; }.content { max-width:1050px; margin:0 auto; padding:38px 34px 22px; }.intro { display:grid; grid-template-columns:1fr 270px; gap:28px; align-items:end; }.intro h1 { max-width:600px; margin:12px 0 9px; font-size:clamp(30px,4vw,48px); letter-spacing:-.055em; line-height:1.05; }.intro p { max-width:580px; margin:0; color:#949b94; font-size:14px; line-height:1.65; }.mode-card { border:1px solid #303530; background:#1b1f1b; padding:14px; border-radius:13px; }.mode-toggle { display:grid; grid-template-columns:1fr 1fr; gap:4px; background:#111311; padding:4px; border-radius:9px; margin:10px 0 8px; }.mode-toggle button { border:0; border-radius:7px; padding:8px 4px; background:transparent; color:#8c948c; font-size:11px; cursor:pointer; }.mode-toggle button.active { background:#dce6dd; color:#182019; font-weight:750; }.mode-card small { color:#747b74; font-size:9px; }
        .privacy-note { margin:24px 0 19px; display:flex; gap:10px; align-items:center; border:1px solid #29382c; background:#19211b; padding:11px 13px; border-radius:10px; }.privacy-note>span { width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:#2a3a2d; color:#8ed39d; font-size:11px; }.privacy-note strong,.privacy-note small { display:block; }.privacy-note strong { font-size:10px; }.privacy-note small { color:#879088; font-size:9px; margin-top:3px; }
        .radar,.tools,.prompts { border:1px solid #2d322d; background:#191c19; border-radius:15px; padding:18px; margin-top:14px; }.section-head { display:flex; justify-content:space-between; gap:14px; align-items:center; }.section-head h2,.prompts h2 { margin:5px 0 0; font-size:18px; letter-spacing:-.035em; }.open-count { text-align:right; }.open-count strong,.open-count small { display:block; }.open-count strong { font-size:21px; }.open-count small { color:#7e867e; font-size:9px; }
        .loop { display:flex; align-items:center; justify-content:space-between; gap:15px; border:1px solid #453d2c; background:#211f19; padding:15px; border-radius:11px; margin-top:14px; }.loop.secondary { border-color:#303530; background:#1d201d; margin-top:8px; }.loop-copy { min-width:0; }.loop-copy>span { font-size:8px; letter-spacing:.11em; font-weight:800; color:#c3a66c; }.loop-copy .open { color:#8bb496; }.loop h3 { font-size:13px; margin:7px 0 4px; }.loop p,.loop small { color:#858d85; font-size:10px; margin:0; line-height:1.5; }.loop small { display:block; margin-top:5px; }.handle,.text-action { flex:0 0 auto; border:1px solid #e0e5e0; border-radius:8px; padding:9px 11px; background:#e0e5e0; color:#151815; font-weight:750; font-size:10px; cursor:pointer; }.handle span { margin-left:7px; }.text-action { border-color:transparent; background:transparent; color:#a8bbaa; font-weight:600; }
        .tools { margin-top:15px; }.mode-caption { color:#88948a; background:#222923; border-radius:30px; padding:6px 9px; font-size:9px; }.tool-grid { margin-top:13px; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }.tool-card { border:1px solid #303530; background:#202320; min-height:69px; border-radius:10px; padding:11px; display:flex; align-items:center; gap:9px; color:#e0e4e0; text-align:left; cursor:pointer; }.tool-card:hover { border-color:#607362; background:#252b26; }.tool-icon { width:29px; height:29px; border-radius:8px; display:grid; place-items:center; background:#2c332d; color:#b3cdb7; }.tool-card strong { font-size:10px; }.arrow { margin-left:auto; color:#707a71; font-size:11px; }
        .prompts { margin-top:15px; }.prompt-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:13px; }.prompt-list button { display:flex; align-items:center; justify-content:space-between; gap:8px; border:1px solid #303530; background:#202320; color:#bfc6bf; text-align:left; padding:11px; border-radius:9px; font-size:10px; cursor:pointer; }.prompt-list button:hover,.prompt-list button.chosen { background:#29322a; border-color:#58705b; color:#eff4ef; }.prompt-list button span { color:#91b498; }.prompt-feedback { color:#99b79f; font-size:10px; margin:10px 0 0; }
        footer { display:flex; gap:15px; align-items:center; padding:24px 3px 4px; color:#697169; font-size:9px; }footer a { margin-left:auto; color:#a5bba8; text-decoration:none; }
        @media(max-width:760px) { .sidebar { display:none; }.topbar { height:58px; padding:0 16px; }.mobile-brand { display:flex; align-items:center; gap:8px; font-size:12px; }.mobile-brand .brand-mark { width:28px; height:28px; border-radius:9px; font-size:14px; }.top-title { display:none; }.content { padding:25px 14px 20px; }.intro { grid-template-columns:1fr; gap:17px; }.intro h1 { font-size:35px; }.intro p { font-size:12px; }.mode-card { max-width:100%; }.radar,.tools,.prompts { padding:14px; }.loop { align-items:flex-start; flex-direction:column; }.handle,.text-action { align-self:flex-start; }.tool-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.prompt-list { grid-template-columns:1fr; }.section-head h2,.prompts h2 { font-size:16px; }footer { flex-wrap:wrap; }footer a { margin-left:0; width:100%; } }
      `}</style>
    </main>
  );
}

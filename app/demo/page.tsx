'use client';

import React, { useEffect, useState } from 'react';

type Mode = 'everyday' | 'business';
type RadarItem = { id: string; state: string; title: string; context: string; next: string };

const toolsByMode: Record<Mode, string[]> = {
  everyday: ['Life Radar', 'Chat', 'Tasks', 'People', 'Memory', 'Focus Brief', 'Search'],
  business: ['Life Radar', 'Build a quote', 'Email drafts', 'Tasks', 'People', 'Projects', 'Search'],
};

const promptsByMode: Record<Mode, string[]> = {
  everyday: ['What am I forgetting this week?', 'Help me plan tomorrow.', 'Remind me to renew my car registration.'],
  business: ['Turn these notes into a quote.', 'Follow up on an unfinished quote.', 'What should I do next on this project?'],
};

const radarByMode: Record<Mode, RadarItem[]> = {
  everyday: [
    { id: 'jamie', state: 'WAITING · 3D', title: 'Reply to Jamie about Saturday', context: 'Jamie asked whether 2:00 PM works. You have not answered yet.', next: 'Confirm the time and keep the reply as a draft.' },
    { id: 'groceries', state: 'OPEN · TODAY', title: 'Pick up the groceries you listed', context: 'Milk, coffee, fruit, and sandwich supplies are still on your list.', next: 'Open Tasks and check off the list at the store.' },
  ],
  business: [
    { id: 'quote', state: 'WAITING · 3D', title: 'Finish a quote for the kitchen refresh', context: 'The scope notes include cabinets, trim, labor, and a two-day site window.', next: 'Open the quote draft and add labor before sending.' },
    { id: 'visit', state: 'OPEN · TODAY', title: 'Confirm tomorrow’s site visit', context: 'The client is expecting an arrival window but has not received one.', next: 'Draft a short confirmation with the arrival time.' },
  ],
};

function sampleReply(mode: Mode, prompt: string) {
  if (mode === 'business') {
    return `You have two business loops to handle: finish the kitchen quote and confirm tomorrow’s site visit. I’d start with the site confirmation because the client is waiting, then finish the quote while the notes are fresh.`;
  }
  return `You have two loose ends this week: reply to Jamie about Saturday and pick up the groceries on your saved list. Jamie has been waiting three days, so I’d handle that first.`;
}

export default function PublicDemoPage() {
  useEffect(() => {
    document.documentElement.classList.add('demo-page-scroll');
    document.body.classList.add('demo-page-scroll');
    return () => {
      document.documentElement.classList.remove('demo-page-scroll');
      document.body.classList.remove('demo-page-scroll');
    };
  }, []);

  const [mode, setMode] = useState<Mode>('everyday');
  const [activeTool, setActiveTool] = useState('Life Radar');
  const [expandedId, setExpandedId] = useState('jamie');
  const [awayOpen, setAwayOpen] = useState(true);
  const [chatPrompt, setChatPrompt] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const tools = toolsByMode[mode];
  const radarItems = radarByMode[mode];

  const switchMode = (nextMode: Mode) => {
    if (nextMode === mode) return;
    setTransitioning(true);
    setMode(nextMode);
    setActiveTool('Life Radar');
    setExpandedId(radarByMode[nextMode][0].id);
    window.setTimeout(() => setTransitioning(false), 360);
  };

  const openChat = (prompt: string) => {
    setChatPrompt(prompt);
    setActiveTool('Chat');
    window.setTimeout(() => document.getElementById('demo-chat')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  return (
    <main className="demo">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Life’s Assistant">
          <span className="brand-mark">✦</span>
          <span><strong>Life’s Assistant</strong><small>Personal AI workspace</small></span>
        </a>
        <div className="demo-tag"><span /> PREVIEW MODE</div>
        <p className="nav-label">YOUR WORKSPACE</p>
        <nav aria-label="Demo tools" className={transitioning ? 'mode-changing' : ''}>
          {tools.map((tool, i) => (
            <button className={activeTool === tool ? 'nav-item selected' : 'nav-item'} key={tool} style={{ animationDelay: `${i * 30}ms` }} onClick={() => setActiveTool(tool)}>
              <span className="nav-icon">{['◌','✦','✓','◎','◉','◈','⌕','▤'][i % 8]}</span>{tool}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom"><p>Want your own private workspace?</p><a href="/">Create an account <span>→</span></a></div>
      </aside>

      <section className="main">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">✦</span><strong>Life’s Assistant</strong></div>
          <div className="top-title">{activeTool}<small>Sample workspace</small></div>
          <span className="preview-pill"><i /> Read-only demo</span>
        </header>
        <div className="status-strip"><span className="pulse" />Assistant is watching <strong>2 open loops</strong><span>·</span><strong>1 waiting on you</strong></div>

        <div className="content">
          <section className="away-card">
            <button onClick={() => setAwayOpen((open) => !open)} aria-expanded={awayOpen}>
              <span className="away-icon">↻</span>
              <span><small>WHILE YOU WERE AWAY</small><strong>{mode === 'business' ? 'Quote notes are still waiting · site confirmation is ready' : '1 draft ready for Jamie · your saved list is still open'}</strong></span>
              <b>{awayOpen ? 'Hide' : 'Show'}⌄</b>
            </button>
            {awayOpen && <div className="away-detail"><span>✓</span><p>{mode === 'business' ? 'The assistant kept the quote context together and prepared the next action.' : 'The assistant kept Jamie’s message and your suggested reply together.'}</p><button onClick={() => setExpandedId(radarItems[0].id)}>Review now →</button></div>}
          </section>

          <div className="intro">
            <div><div className="eyebrow">A CALMER WAY TO KEEP LIFE MOVING</div><h1>Your life, with fewer loose ends.</h1><p>See what needs attention, pick up where you left off, and turn the next step into something you can do.</p></div>
            <div className="mode-card">
              <span className="eyebrow">EXPLORE A MODE</span>
              <div className="mode-toggle" role="group" aria-label="Choose demo mode">
                <button className={mode === 'everyday' ? 'active' : ''} onClick={() => switchMode('everyday')}>Everyday</button>
                <button className={mode === 'business' ? 'active' : ''} onClick={() => switchMode('business')}>Business</button>
              </div>
              <small>Everyday: personal loose ends · Business: quotes, site visits, follow-ups.</small>
            </div>
          </div>

          <div className="privacy-note"><span>✓</span><div><strong>Sample data only</strong><small>This public preview doesn’t connect to anyone’s account or show saved conversations.</small></div></div>

          <section className={`radar ${transitioning ? 'mode-changing' : ''}`}>
            <div className="section-head"><div><div className="eyebrow">LIFE RADAR</div><h2>What needs your attention?</h2></div><div className="open-count"><strong>2</strong><small>open loops</small></div></div>
            <div className="radar-list">
              {radarItems.map((item, i) => {
                const expanded = expandedId === item.id;
                return (
                  <article key={item.id} className={`loop ${expanded ? 'expanded' : ''}`} style={{ animationDelay: `${i * 45}ms` }}>
                    <button className="loop-summary" onClick={() => setExpandedId(expanded ? '' : item.id)} aria-expanded={expanded}>
                      <span><small>{item.state}</small><strong>{item.title}</strong></span><b>{expanded ? '−' : '+'}</b>
                    </button>
                    {expanded && <div className="loop-detail">
                      <div><small>CONTEXT</small><p>{item.context}</p></div>
                      <div><small>SUGGESTED NEXT ACTION</small><p>{item.next}</p></div>
                      <div className="loop-actions">
                        <button className="primary" onClick={() => openChat(`Draft a reply for: ${item.title}`)}>Draft reply</button>
                        <button onClick={() => setExpandedId(item.id)}>Mark done</button>
                      </div>
                    </div>}
                    <button className="handle" onClick={() => setExpandedId(item.id)}>Handle it <span>→</span></button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={`tools ${transitioning ? 'mode-changing' : ''}`}>
            <div className="section-head"><div><div className="eyebrow">YOUR TOOLS</div><h2>Start with what matters</h2></div><span className="mode-caption">{mode === 'business' ? 'Business mode' : 'Everyday mode'}</span></div>
            <div className="tool-grid">{tools.slice(0, 6).map((tool, i) => <button key={tool} style={{ animationDelay: `${i * 30}ms` }} onClick={() => setActiveTool(tool)} className="tool-card"><span className="tool-icon">{['◌','✦','✓','◎','◉','◈'][i % 6]}</span><strong>{tool}</strong><span className="arrow">↗</span></button>)}</div>
          </section>

          <section className="prompts">
            <div className="eyebrow">TRY ASKING</div><h2>Just say what you need.</h2>
            <div className="prompt-list">{promptsByMode[mode].map((prompt) => <button key={prompt} className={chatPrompt === prompt ? 'chosen' : ''} onClick={() => openChat(prompt)}>{prompt}<span>→</span></button>)}</div>
          </section>

          {chatPrompt && <section className="chat-panel" id="demo-chat">
            <div className="chat-head"><span className="assistant-avatar">✦</span><div><strong>Life’s Assistant</strong><small>Sample conversation</small></div><button onClick={() => setChatPrompt('')} aria-label="Close sample chat">×</button></div>
            <div className="user-message">{chatPrompt}</div>
            <div className="assistant-message">{sampleReply(mode, chatPrompt)}<div><button onClick={() => setExpandedId(radarItems[0].id)}>Show me the first item →</button></div></div>
          </section>}

          <footer><span>Life’s Assistant</span><span>Preview link · no account needed</span><a href="/">Open sign-in page →</a></footer>
        </div>
      </section>

      <style jsx>{`
        *{box-sizing:border-box}.demo{min-height:100vh;background:#141614;color:#f0f2ef;display:flex;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sidebar{width:248px;flex:0 0 248px;background:#101210;border-right:1px solid #292d29;padding:22px 15px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh}.brand{display:flex;gap:10px;align-items:center;color:inherit;text-decoration:none;padding:2px 5px 25px}.brand-mark{width:35px;height:35px;border-radius:11px;display:grid;place-items:center;background:#e6e9e4;color:#171a17;font-size:18px}.brand strong,.brand small{display:block}.brand strong{font-size:13px}.brand small{color:#747c75;font-size:10px;margin-top:3px}.demo-tag{background:#1c241e;border:1px solid #303c32;color:#a9c6ae;padding:9px 11px;border-radius:9px;font-size:9px;letter-spacing:.12em;font-weight:800}.demo-tag span,.preview-pill i{display:inline-block;width:7px;height:7px;background:#72c58a;border-radius:50%;margin-right:7px}.nav-label,.eyebrow{color:#777f78;font-size:9px;letter-spacing:.15em;font-weight:800}.nav-label{margin:29px 8px 9px}nav{display:grid;gap:3px}.nav-item{border:0;background:transparent;color:#aeb4ae;display:flex;gap:10px;align-items:center;border-radius:8px;text-align:left;padding:10px 9px;font-size:12px;cursor:pointer}.nav-item:hover,.nav-item.selected{background:#252925;color:#fff}.nav-icon{width:18px;color:#89998b;text-align:center}.sidebar-bottom{margin-top:auto;padding:14px 9px 3px;border-top:1px solid #292d29}.sidebar-bottom p{color:#798078;font-size:10px;line-height:1.5}.sidebar-bottom a{color:#d1e6d5;font-size:11px;text-decoration:none;font-weight:700}.main{min-width:0;flex:1}.topbar{height:64px;border-bottom:1px solid #292d29;display:flex;align-items:center;padding:0 32px;gap:14px;position:sticky;top:0;background:rgba(20,22,20,.96);backdrop-filter:blur(12px);z-index:3}.top-title{font-weight:700;font-size:13px}.top-title small{display:block;color:#737a73;font-size:10px;font-weight:400;margin-top:3px}.preview-pill{margin-left:auto;border:1px solid #343c35;border-radius:30px;color:#aeb8af;padding:7px 10px;font-size:10px}.preview-pill i{width:6px;height:6px}.mobile-brand{display:none}.status-strip{position:sticky;top:64px;z-index:2;min-height:30px;display:flex;align-items:center;justify-content:center;gap:6px;background:#19201a;border-bottom:1px solid #2c382e;color:#8e998f;font-size:9px}.status-strip strong{color:#bfcec1}.pulse{width:6px;height:6px;border-radius:50%;background:#72c58a;box-shadow:0 0 0 3px rgba(114,197,138,.1)}.content{max-width:1050px;margin:0 auto;padding:24px 34px 22px}.away-card{border:1px solid #344139;background:linear-gradient(135deg,#1b251e,#191e1a);border-radius:13px;margin-bottom:22px;overflow:hidden}.away-card>button{width:100%;border:0;background:transparent;color:#eff4ef;padding:13px 14px;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;text-align:left;cursor:pointer}.away-icon{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#29372d;color:#8ed39d}.away-card small,.away-card strong{display:block}.away-card small{color:#718078;font-size:8px;letter-spacing:.13em}.away-card strong{font-size:11px;margin-top:4px}.away-card b{font-size:9px;color:#829087}.away-detail{border-top:1px solid #2b382f;padding:11px 14px 11px 55px;display:flex;align-items:center;gap:9px}.away-detail>span{color:#83ca95}.away-detail p{font-size:10px;color:#879389;margin:0}.away-detail button{margin-left:auto;border:0;background:transparent;color:#a9cbb0;font-size:9px;cursor:pointer}.intro{display:grid;grid-template-columns:1fr 285px;gap:28px;align-items:end}.intro h1{max-width:600px;margin:12px 0 9px;font-size:clamp(30px,4vw,48px);letter-spacing:-.055em;line-height:1.05}.intro p{max-width:580px;margin:0;color:#949b94;font-size:14px;line-height:1.65}.mode-card{border:1px solid #303530;background:#1b1f1b;padding:14px;border-radius:13px}.mode-toggle{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#111311;padding:4px;border-radius:9px;margin:10px 0 8px}.mode-toggle button{border:0;border-radius:7px;padding:8px 4px;background:transparent;color:#8c948c;font-size:11px;cursor:pointer}.mode-toggle button.active{background:#dce6dd;color:#182019;font-weight:750}.mode-card small{color:#747b74;font-size:9px;line-height:1.45}.privacy-note{margin:24px 0 19px;display:flex;gap:10px;align-items:center;border:1px solid #29382c;background:#19211b;padding:11px 13px;border-radius:10px}.privacy-note>span{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:#2a3a2d;color:#8ed39d;font-size:11px}.privacy-note strong,.privacy-note small{display:block}.privacy-note strong{font-size:10px}.privacy-note small{color:#879088;font-size:9px;margin-top:3px}.radar,.tools,.prompts,.chat-panel{border:1px solid #2d322d;background:#191c19;border-radius:15px;padding:18px;margin-top:14px}.section-head{display:flex;justify-content:space-between;gap:14px;align-items:center}.section-head h2,.prompts h2{margin:5px 0 0;font-size:18px;letter-spacing:-.035em}.open-count{text-align:right}.open-count strong,.open-count small{display:block}.open-count strong{font-size:21px}.open-count small{color:#7e867e;font-size:9px}.radar-list{display:grid;gap:8px;margin-top:14px}.loop{position:relative;border:1px solid #343934;background:#1d201d;border-radius:11px;overflow:hidden;transition:border-color .2s ease,background .2s ease}.loop.expanded{border-color:#4a5d4e;background:#202620}.loop-summary{width:100%;border:0;background:transparent;color:inherit;padding:14px 118px 14px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;text-align:left;cursor:pointer}.loop-summary small,.loop-summary strong{display:block}.loop-summary small{font-size:8px;letter-spacing:.11em;color:#c3a66c;font-weight:800}.loop-summary strong{font-size:12px;margin-top:5px}.loop-summary b{color:#8da291;font-size:16px}.loop-detail{padding:0 14px 14px;display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;animation:reveal .2s ease}.loop-detail small{color:#718078;font-size:8px;letter-spacing:.11em;font-weight:800}.loop-detail p{color:#929b93;font-size:10px;line-height:1.5;margin:5px 0 0}.loop-actions{display:flex;gap:6px}.loop-actions button,.handle{border:1px solid #3a433b;border-radius:8px;padding:8px 10px;background:#252b26;color:#b9c3bb;font-size:9px;cursor:pointer;white-space:nowrap}.loop-actions .primary{background:#e0e5e0;border-color:#e0e5e0;color:#151815;font-weight:750}.handle{position:absolute;right:12px;top:12px;background:#e0e5e0;color:#151815;font-weight:750}.tools{margin-top:15px}.mode-caption{color:#88948a;background:#222923;border-radius:30px;padding:6px 9px;font-size:9px}.tool-grid{margin-top:13px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.tool-card{border:1px solid #303530;background:#202320;min-height:69px;border-radius:10px;padding:11px;display:flex;align-items:center;gap:9px;color:#e0e4e0;text-align:left;cursor:pointer}.tool-card:hover{border-color:#607362;background:#252b26}.tool-icon{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;background:#2c332d;color:#b3cdb7}.tool-card strong{font-size:10px}.arrow{margin-left:auto;color:#707a71}.mode-changing .tool-card,.mode-changing .loop,.mode-changing .nav-item{animation:modeShift .34s ease both}.prompts{margin-top:15px}.prompt-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px}.prompt-list button{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #303530;background:#202320;color:#bfc6bf;text-align:left;padding:11px;border-radius:9px;font-size:10px;cursor:pointer}.prompt-list button:hover,.prompt-list button.chosen{background:#29322a;border-color:#58705b;color:#eff4ef}.prompt-list button span{color:#91b498}.chat-panel{scroll-margin-top:110px;background:#181d19;border-color:#3c4b3e}.chat-head{display:flex;align-items:center;gap:9px}.assistant-avatar{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#dce6dd;color:#172018}.chat-head strong,.chat-head small{display:block}.chat-head strong{font-size:11px}.chat-head small{color:#747e75;font-size:9px;margin-top:2px}.chat-head>button{margin-left:auto;border:0;background:transparent;color:#899189;font-size:20px;cursor:pointer}.user-message{width:fit-content;max-width:80%;margin:16px 0 10px auto;padding:10px 12px;border-radius:12px 12px 3px 12px;background:#2b312c;color:#dfe5df;font-size:10px}.assistant-message{max-width:86%;padding:11px 12px;border-radius:3px 12px 12px 12px;background:#222923;color:#b8c3ba;font-size:10px;line-height:1.55}.assistant-message button{margin-top:9px;border:0;background:transparent;color:#9ec0a4;font-size:9px;cursor:pointer}footer{display:flex;gap:15px;align-items:center;padding:24px 3px 4px;color:#697169;font-size:9px}footer a{margin-left:auto;color:#a5bba8;text-decoration:none}@keyframes reveal{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}@keyframes modeShift{0%{opacity:.35;transform:translateY(5px) scale(.985)}100%{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;animation:none!important;transition:none!important}}@media(max-width:760px){.sidebar{display:none}.topbar{height:58px;padding:0 14px}.mobile-brand{display:flex;align-items:center;gap:8px;font-size:12px}.mobile-brand .brand-mark{width:28px;height:28px;border-radius:9px;font-size:14px}.top-title{display:none}.status-strip{top:58px;padding:6px 12px;flex-wrap:wrap}.content{padding:16px 14px 20px}.away-detail{padding:10px 13px;align-items:flex-start;flex-wrap:wrap}.away-detail button{margin-left:24px}.intro{grid-template-columns:1fr;gap:17px}.intro h1{font-size:35px}.intro p{font-size:12px}.radar,.tools,.prompts,.chat-panel{padding:14px}.loop-summary{padding:14px 14px 52px}.handle{top:auto;left:12px;right:auto;bottom:10px}.loop-detail{grid-template-columns:1fr;gap:10px;padding-bottom:54px}.loop-actions{position:absolute;bottom:10px;left:12px}.loop.expanded .handle{display:none}.tool-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.prompt-list{grid-template-columns:1fr}.section-head h2,.prompts h2{font-size:16px}footer{flex-wrap:wrap}footer a{margin-left:0;width:100%}}
      `}</style>
    </main>
  );
}

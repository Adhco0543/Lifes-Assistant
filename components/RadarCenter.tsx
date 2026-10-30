'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend, type OpenLoop } from '../lib/firebaseBackend';
import { DAY_MS } from '../lib/workspaceRadar';
import { DEFAULT_LIFE_PREFERENCES, normalizeLifePreferences, scoreRadarItem, explainRadarItem, suggestedRadarView, type LifePreferences } from '../lib/lifePreferences';

interface RadarCenterProps {
  userId: string;
  onNavigate: (view: string) => void;
}

type Filter = 'active' | 'waiting' | 'snoozed' | 'resolved' | 'archived' | 'all';

function formatAge(timestamp: number): string {
  const days = Math.floor(Math.max(0, Date.now() - timestamp) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return days + ' days ago';
}

function isVisibleActive(loop: OpenLoop): boolean {
  if (loop.archived || loop.status === 'resolved') return false;
  if (
    loop.status === 'snoozed' &&
    loop.snoozedUntil &&
    loop.snoozedUntil > Date.now()
  ) {
    return false;
  }
  return true;
}

export default function RadarCenter({
  userId,
  onNavigate,
}: RadarCenterProps) {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [filter, setFilter] = useState<Filter>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [status, setStatus] = useState('Loading Radar…');
  const [scanning, setScanning] = useState(false);
  const [preferences, setPreferences] = useState<LifePreferences>(DEFAULT_LIFE_PREFERENCES);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    const connect = async () => {
      try {
        await firebaseBackend.initialize();
        const [initial, profile] = await Promise.all([firebaseBackend.getOpenLoops(100), firebaseBackend.getUserProfile(userId)]);
        if (!mounted) return;

        setLoops(initial);
        setPreferences(normalizeLifePreferences(profile));
        setStatus('Radar is live across your signed-in devices.');
        unsubscribe = firebaseBackend.onOpenLoopsChange((next) => {
          if (mounted) setLoops(next);
        });
      } catch (error) {
        console.warn('Radar Center could not connect:', error);
        if (mounted) setStatus('Radar cloud sync is unavailable right now.');
      }
    };

    const onScanComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ changes?: number }>).detail || {};
      const changes = Number(detail.changes || 0);
      setScanning(false);
      setStatus(
        changes
          ? 'Scan complete. Radar updated ' +
              changes +
              (changes === 1 ? ' item.' : ' items.')
          : 'Scan complete. Nothing new needs attention.'
      );
    };

    connect();
    window.addEventListener('life-radar-scanned', onScanComplete);

    return () => {
      mounted = false;
      unsubscribe();
      window.removeEventListener('life-radar-scanned', onScanComplete);
    };
  }, [userId]);

  const counts = useMemo(() => {
    return {
      active: loops.filter(isVisibleActive).length,
      waiting: loops.filter((loop) => loop.status === 'waiting').length,
      snoozed: loops.filter(
        (loop) =>
          loop.status === 'snoozed' &&
          Boolean(loop.snoozedUntil && loop.snoozedUntil > Date.now())
      ).length,
      resolved: loops.filter((loop) => loop.status === 'resolved' && !loop.archived).length,
      archived: loops.filter((loop) => loop.archived).length,
      all: loops.filter((loop) => !loop.archived).length,
    };
  }, [loops]);

  const visible = useMemo(() => {
    return loops
      .filter((loop) => {
        if (filter === 'archived') return Boolean(loop.archived);
        if (filter === 'all') return !loop.archived;
        if (filter === 'active') return isVisibleActive(loop);
        if (filter === 'waiting') return loop.status === 'waiting';
        if (filter === 'resolved') return loop.status === 'resolved';
        return (
          loop.status === 'snoozed' &&
          Boolean(loop.snoozedUntil && loop.snoozedUntil > Date.now())
        );
      })
      .sort((a, b) => {
        if (filter === 'resolved') return b.updatedAt - a.updatedAt;
        const attention = scoreRadarItem(b, preferences) - scoreRadarItem(a, preferences);
        if (attention) return attention;
        return b.updatedAt - a.updatedAt;
      });
  }, [filter, loops, preferences]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const bulkResolve = async () => {
    setBulkBusy(true);
    try {
      await Promise.all(selectedIds.map((id) => firebaseBackend.resolveOpenLoop(id)));
      setSelectedIds([]);
      setStatus('Selected items resolved.');
    } catch {
      setStatus('Some items could not be resolved. Try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkArchive = async (ids = selectedIds) => {
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await Promise.all(ids.map((id) => firebaseBackend.updateOpenLoop(id, { archived: true })));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setStatus(ids.length + ' ' + (ids.length === 1 ? 'item' : 'items') + ' archived. You can restore them from Archived.');
    } catch {
      setStatus('Some items could not be archived. Try again.');
    } finally {
      setBulkBusy(false);
    }
  };

  const archiveOld = () => {
    const cutoff = Date.now() - 14 * DAY_MS;
    const oldIds = loops.filter((loop) => !loop.archived && loop.status !== 'resolved' && loop.createdAt < cutoff).map((loop) => loop.id);
    void bulkArchive(oldIds);
  };

  const restore = async (loop: OpenLoop) => {
    await firebaseBackend.updateOpenLoop(loop.id, { archived: false });
  };
  const scanNow = () => {
    setScanning(true);
    setStatus('Scanning Chat and workspace…');
    window.dispatchEvent(new CustomEvent('life-radar-scan'));
  };

  const resolve = async (loop: OpenLoop) => {
    await firebaseBackend.resolveOpenLoop(loop.id);
  };

  const reopen = async (loop: OpenLoop) => {
    await firebaseBackend.updateOpenLoop(loop.id, {
      status: loop.waitingOn ? 'waiting' : 'open',
      snoozedUntil: null,
    });
  };

  const snooze = async (loop: OpenLoop) => {
    await firebaseBackend.snoozeOpenLoop(loop.id, Date.now() + DAY_MS);
  };

  const makeTask = async (loop: OpenLoop) => {
    const title = (loop.nextAction || loop.title).trim();
    if (!title) return;

    const dueDate = loop.dueAt
      ? new Date(loop.dueAt).toISOString().slice(0, 10)
      : '';

    await firebaseBackend.saveBusinessRecord('task', {
      title,
      status: 'open',
      dueDate,
      priority:
        loop.priority === 'high'
          ? 'high'
          : loop.priority === 'low'
            ? 'low'
            : 'normal',
      projectId: '',
      projectName: '',
      source: 'life-radar',
      sourceOpenLoopId: loop.id,
    });

    await firebaseBackend.trackEvent('life_radar.task_created', {
      openLoopId: loop.id,
      title,
    });
    await firebaseBackend.resolveOpenLoop(loop.id);
  };

  const top = loops.filter(isVisibleActive).sort((a, b) => {
    const attention = scoreRadarItem(b, preferences) - scoreRadarItem(a, preferences);
    if (attention) return attention;
    return b.updatedAt - a.updatedAt;
  })[0];

  const filters: Array<{ id: Filter; label: string }> = [
    { id: 'active', label: 'Active' },
    { id: 'waiting', label: 'Waiting' },
    { id: 'snoozed', label: 'Snoozed' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'archived', label: 'Archived' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="radar-center">
      <header className="hero">
        <div>
          <span className="kicker">LIFE RADAR</span>
          <h1>Attention center</h1>
          <p>{status}</p>
        </div>
        <button className="scan" onClick={scanNow} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Scan now'}
        </button>
      </header>

      <section className="score-grid">
        <button onClick={() => setFilter('active')}>
          <strong>{counts.active}</strong>
          <span>need attention</span>
        </button>
        <button onClick={() => setFilter('waiting')}>
          <strong>{counts.waiting}</strong>
          <span>waiting</span>
        </button>
        <button onClick={() => setFilter('snoozed')}>
          <strong>{counts.snoozed}</strong>
          <span>snoozed</span>
        </button>
        <button onClick={() => setFilter('resolved')}>
          <strong>{counts.resolved}</strong>
          <span>resolved</span>
        </button>
      </section>

      {top && filter === 'active' && (
        <section className="top-card">
          <div>
            <span>HANDLE FIRST</span>
            <strong>{top.title}</strong>
            <small>{top.nextAction || top.summary || 'This is Radar’s top current signal.'}</small>
          </div>
          <button onClick={() => onNavigate(suggestedRadarView(top))}>
            Open →
          </button>
        </section>
      )}

      {(filter === 'active' || filter === 'waiting' || filter === 'all') && (
        <div className="bulk-tools" aria-label="Bulk Radar actions">
          <span>{selectedIds.length ? selectedIds.length + ' selected' : 'Clean up older items'}</span>
          <button type="button" onClick={() => void bulkResolve()} disabled={!selectedIds.length || bulkBusy}>Resolve selected</button>
          <button type="button" onClick={() => void bulkArchive()} disabled={!selectedIds.length || bulkBusy}>Archive selected</button>
          <button type="button" onClick={archiveOld} disabled={bulkBusy}>Archive old (14+ days)</button>
        </div>
      )}
      <nav className="filters" aria-label="Radar filters">
        {filters.map((item) => (
          <button
            key={item.id}
            className={filter === item.id ? 'active' : ''}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span>{counts[item.id]}</span>
          </button>
        ))}
      </nav>

      <section className="list">
        {visible.length === 0 ? (
          <div className="empty">
            <strong>No items here.</strong>
            <p>Radar has nothing matching this filter.</p>
          </div>
        ) : (
          visible.map((loop) => {
            const sourceOpen = expandedId === loop.id;
            const waitingDays =
              loop.status === 'waiting'
                ? Math.floor((Date.now() - loop.createdAt) / DAY_MS)
                : 0;

            return (
              <article className={'card ' + loop.priority} key={loop.id}>
                <label className="select-loop"><input type="checkbox" checked={selectedIds.includes(loop.id)} onChange={() => toggleSelected(loop.id)} aria-label={'Select ' + loop.title} /></label>
                <div className="card-copy">
                  <div className="meta">
                    <span className={'dot ' + loop.priority} />
                    <span>
                      {loop.status.toUpperCase()}
                      {waitingDays > 0 ? ' · ' + waitingDays + 'D' : ''}
                    </span>
                    <span>Updated {formatAge(loop.updatedAt)}</span>
                  </div>
                  <h2>{loop.title}</h2>
                  {loop.summary && <p>{loop.summary}</p>}
                  {loop.waitingOn && (
                    <p className="waiting">
                      Waiting on <strong>{loop.waitingOn}</strong>
                    </p>
                  )}
                  {loop.nextAction && (
                    <p className="next">
                      <span>Next:</span> {loop.nextAction}
                    </p>
                  )}
                  {sourceOpen && (
                    <div className="source">
                      <span>WHY THIS IS SHOWING</span>
                      <ul>{explainRadarItem(loop, preferences).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                      {loop.sourceExcerpt && <p className="source-excerpt">From your saved context: “{loop.sourceExcerpt}”</p>}
                    </div>
                  )}
                </div>

                <div className="actions">
                  {loop.archived ? (
                    <button onClick={() => restore(loop)}>Restore</button>
                  ) : loop.status === 'resolved' ? (
                    <button onClick={() => reopen(loop)}>Reopen</button>
                  ) : (
                    <>
                      <button
                        className="primary"
                        onClick={() => onNavigate(suggestedRadarView(loop))}
                      >
                        Handle it
                      </button>
                      {loop.source !== 'workspace-task' && (
                        <button onClick={() => makeTask(loop)}>Make task</button>
                      )}
                      <button onClick={() => snooze(loop)}>Tomorrow</button>
                      <button onClick={() => resolve(loop)}>Resolve</button>
                      <button onClick={() => void bulkArchive([loop.id])}>Archive</button>
                    </>
                  )}
                  {true && (
                    <button
                      className="why"
                      onClick={() => setExpandedId(sourceOpen ? null : loop.id)}
                    >
                      {sourceOpen ? 'Hide reasons' : 'Why am I seeing this?'}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <style jsx>{`
        .radar-center {
          height: 100%;
          overflow-y: auto;
          padding: 26px;
          background: #212121;
          color: #eee;
        }
        .hero {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
        }
        .kicker {
          color: #7f8d85;
          font-size: .62rem;
          letter-spacing: .15em;
          font-weight: 800;
        }
        h1 {
          margin: 5px 0 4px;
          font-size: 1.65rem;
          letter-spacing: -.035em;
        }
        .hero p {
          margin: 0;
          color: #777;
          font-size: .72rem;
        }
        button {
          border: 1px solid #383838;
          background: #262626;
          color: #d7d7d7;
          cursor: pointer;
          border-radius: 10px;
        }
        button:hover { background: #303030; }
        button:disabled { opacity: .55; cursor: default; }
        .scan {
          padding: 9px 13px;
          font-size: .72rem;
          font-weight: 700;
        }
        .score-grid {
          max-width: 1100px;
          margin: 18px auto 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 9px;
        }
        .score-grid button {
          padding: 13px;
          text-align: left;
          background: #191919;
        }
        .score-grid strong,
        .score-grid span { display: block; }
        .score-grid strong { font-size: 1.2rem; }
        .score-grid span {
          margin-top: 2px;
          color: #777;
          font-size: .63rem;
        }
        .top-card {
          max-width: 1100px;
          margin: 12px auto 0;
          padding: 14px;
          border: 1px solid #4b402e;
          background: rgba(78, 62, 35, .3);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .top-card div span,
        .top-card div strong,
        .top-card div small { display: block; }
        .top-card div span {
          color: #aa946d;
          font-size: .56rem;
          letter-spacing: .13em;
          font-weight: 800;
        }
        .top-card div strong { margin-top: 4px; font-size: .85rem; }
        .top-card div small {
          margin-top: 4px;
          color: #8d8577;
          line-height: 1.4;
        }
        .top-card button {
          flex: 0 0 auto;
          padding: 8px 11px;
        }
        .bulk-tools { max-width: 1100px; margin: 12px auto 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #777; font-size: .65rem; }
        .bulk-tools button { padding: 7px 10px; font-size: .62rem; }
        .filters {
          max-width: 1100px;
          margin: 18px auto 0;
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }
        .filters button {
          padding: 7px 10px;
          font-size: .66rem;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .filters button.active {
          background: #e8e8e8;
          color: #151515;
          border-color: #e8e8e8;
        }
        .filters span {
          opacity: .62;
          font-size: .6rem;
        }
        .list {
          max-width: 1100px;
          margin: 10px auto 40px;
          display: grid;
          gap: 9px;
        }
        .card {
          background: #191919;
          border: 1px solid #303030;
          border-left-width: 3px;
          border-radius: 14px;
          padding: 14px;
          display: grid;
          grid-template-columns: 20px minmax(0, 1fr) auto;
          gap: 16px;
        }
        .card.high { border-left-color: #a46d62; }
        .card.medium { border-left-color: #9b8554; }
        .card.low { border-left-color: #587663; }
        .select-loop { display: flex; align-items: flex-start; padding-top: 3px; }
        .select-loop input { accent-color: #91c6a0; }
        .meta {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #696969;
          font-size: .56rem;
          letter-spacing: .05em;
        }
        .meta span:last-child { margin-left: 4px; letter-spacing: 0; }
        .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #666;
        }
        .dot.high { background: #a46d62; }
        .dot.medium { background: #9b8554; }
        .dot.low { background: #587663; }
        h2 {
          margin: 7px 0 4px;
          font-size: .9rem;
        }
        .card-copy > p {
          margin: 4px 0 0;
          color: #8b8b8b;
          font-size: .68rem;
          line-height: 1.45;
        }
        .waiting strong { color: #b6a679; }
        .next span { color: #8eb59c; font-weight: 700; }
        .source {
          margin-top: 10px;
          padding: 10px;
          border: 1px solid #303030;
          border-radius: 10px;
          background: #151515;
        }
        .source span {
          color: #777;
          font-size: .53rem;
          letter-spacing: .1em;
          font-weight: 800;
        }
        .source ul { margin: 6px 0 0; padding-left: 18px; color: #b7b7b7; font-size: .66rem; line-height: 1.55; }
        .source p {
          margin: 5px 0 0;
          color: #999;
          font-size: .66rem;
          line-height: 1.45;
        }
        .actions {
          min-width: 110px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .actions button {
          padding: 7px 9px;
          font-size: .61rem;
          white-space: nowrap;
        }
        .actions .primary {
          background: #e4e4e4;
          color: #161616;
          border-color: #e4e4e4;
          font-weight: 750;
        }
        .actions .why { color: #777; }
        .empty {
          padding: 36px 18px;
          text-align: center;
          border: 1px dashed #363636;
          border-radius: 14px;
          color: #888;
        }
        .empty strong { color: #c8c8c8; }
        .empty p { margin: 4px 0 0; font-size: .7rem; }
        @media (max-width: 720px) {
          .radar-center { padding: 18px 12px; }
          .hero { align-items: center; }
          .score-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .card { grid-template-columns: 20px minmax(0, 1fr); }
          .card .actions { grid-column: 2; }
          .actions { flex-direction: row; flex-wrap: wrap; }
          .top-card { align-items: flex-start; }
        }
      `}</style>
    </div>
  );
}

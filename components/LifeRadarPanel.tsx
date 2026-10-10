'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  firebaseBackend,
  type ContinuityState,
  type OpenLoop,
} from '../lib/firebaseBackend';

interface LifeRadarPanelProps {
  userId: string;
  onNavigate: (view: string) => void;
}

function deviceLabel(device: ContinuityState['device']): string {
  if (device === 'phone') return 'Phone';
  if (device === 'tablet') return 'Tablet';
  if (device === 'desktop') return 'Desktop';
  return 'Another device';
}

function timeAgo(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'just now';
  if (diff < hour) {
    const value = Math.floor(diff / minute);
    return value + (value === 1 ? ' minute ago' : ' minutes ago');
  }
  if (diff < day) {
    const value = Math.floor(diff / hour);
    return value + (value === 1 ? ' hour ago' : ' hours ago');
  }

  const value = Math.floor(diff / day);
  return value + (value === 1 ? ' day ago' : ' days ago');
}

function priorityWeight(priority: OpenLoop['priority']): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

type WorkspaceRadarLoop = {
  title: string;
  summary?: string;
  status: 'open' | 'waiting';
  priority: 'low' | 'medium' | 'high';
  waitingOn?: string;
  nextAction?: string;
  dueAt?: number | null;
  source: 'workspace-task' | 'workspace-quote' | 'workspace-draft' | 'workspace-project';
  sourceId: string;
  sourceExcerpt?: string;
  linkedView: string;
  snoozedUntil?: number | null;
  sourceUpdatedAt: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_QUOTE_MS = 7 * DAY_MS;
const ABANDONED_DRAFT_MS = 30 * 60 * 1000;
const STALLED_PROJECT_MS = 14 * DAY_MS;
const VERY_STALLED_PROJECT_MS = 30 * DAY_MS;

function recordUpdatedAt(record: Record<string, unknown>): number {
  return Number(record.updatedAt || record.createdAt || Date.now());
}
function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function localNoonFromDateKey(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
}


function quoteIsClosed(data: Record<string, unknown>): boolean {
  const status = String(data.status || '').toLowerCase();
  return ['accepted', 'complete', 'completed', 'closed', 'declined', 'rejected'].includes(status);
}

function hasQuoteDraft(data: Record<string, unknown>): boolean {
  return Boolean(
    String(data.clientName || '').trim() ||
    String(data.projectDescription || '').trim() ||
    String(data.notes || '').trim() ||
    String(data.draft || '').trim() ||
    (Array.isArray(data.items) && data.items.length)
  );
}

function hasEmailDraft(data: Record<string, unknown>): boolean {
  return Boolean(
    String(data.to || data.recipient || '').trim() ||
    String(data.subject || '').trim() ||
    String(data.request || data.instructions || '').trim() ||
    String(data.body || '').trim()
  );
}

async function syncWorkspaceRadar(existingLoops: OpenLoop[]): Promise<number> {
  const now = Date.now();
  const todayKey = localDateKey();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = localDateKey(tomorrow);
  const desired: WorkspaceRadarLoop[] = [];

  const [records, quoteDraft, emailDraft] = await Promise.all([
    firebaseBackend.getRecentBusinessRecords(250),
    firebaseBackend.getLatestDraft('work-quote'),
    firebaseBackend.getLatestDraft('work-email'),
  ]);

  const projectActivity = new Map<string, number>();

  for (const rawRecord of records) {
    const record = rawRecord as Record<string, unknown>;
    const data = ((record.data || {}) as Record<string, unknown>);
    const recordId = String(record.id || '');
    const updatedAt = recordUpdatedAt(record);

    if (record.kind === 'project' && recordId) {
      projectActivity.set(
        recordId,
        Math.max(projectActivity.get(recordId) || 0, updatedAt)
      );
    }

    const linkedProjectId =
      typeof data.projectId === 'string'
        ? data.projectId
        : typeof data.workspaceProjectId === 'string'
          ? data.workspaceProjectId
          : '';

    if (linkedProjectId) {
      projectActivity.set(
        linkedProjectId,
        Math.max(projectActivity.get(linkedProjectId) || 0, updatedAt)
      );
    }
  }

  for (const rawRecord of records) {
    const record = rawRecord as Record<string, unknown>;
    const data = ((record.data || {}) as Record<string, unknown>);
    const id = String(record.id || '');
    if (!id) continue;

    if (record.kind === 'task') {
      const title = String(data.title || '').trim();
      const dueDate = typeof data.dueDate === 'string' ? data.dueDate : '';
      const done = data.status === 'done';

      if (title && dueDate && !done && dueDate <= tomorrowKey) {
        const dueAt = localNoonFromDateKey(dueDate);
        const isOverdue = dueDate < todayKey;
        const isToday = dueDate === todayKey;
        const daysOverdue = isOverdue
          ? Math.max(1, Math.floor((now - dueAt) / DAY_MS) + 1)
          : 0;

        desired.push({
          title: isOverdue
            ? 'Overdue: ' + title
            : isToday
              ? 'Due today: ' + title
              : 'Due tomorrow: ' + title,
          summary: isOverdue
            ? 'This task is ' +
              daysOverdue +
              (daysOverdue === 1 ? ' day' : ' days') +
              ' overdue.'
            : isToday
              ? 'This task is due today.'
              : 'This task is due tomorrow.',
          status: 'open',
          priority: isOverdue || isToday ? 'high' : 'medium',
          nextAction: isOverdue
            ? 'Complete it, reschedule it, or update the task.'
            : 'Plan the next step before the due date arrives.',
          dueAt,
          source: 'workspace-task',
          sourceId: id,
          sourceExcerpt: 'Task: ' + title + ' · Due ' + dueDate,
          linkedView: 'tasks',
          snoozedUntil: null,
          sourceUpdatedAt: recordUpdatedAt(record),
        });
      }
    }

    if (record.kind === 'quote' && !quoteIsClosed(data)) {
      const updatedAt = recordUpdatedAt(record);
      const age = now - updatedAt;

      if (age >= STALE_QUOTE_MS) {
        const daysOld = Math.max(7, Math.floor(age / DAY_MS));
        const clientName = String(data.clientName || '').trim();
        const projectDescription = String(data.projectDescription || '').trim();
        const label = clientName || projectDescription || 'saved quote';

        desired.push({
          title: 'Review stale quote: ' + label.slice(0, 55),
          summary:
            'This quote was last updated ' +
            daysOld +
            ' days ago and no closed status is recorded.',
          status: 'open',
          priority: daysOld >= 14 ? 'high' : 'medium',
          nextAction: 'Review the quote and decide whether it needs follow-up.',
          dueAt: null,
          source: 'workspace-quote',
          sourceId: id,
          sourceExcerpt:
            (clientName ? 'Client: ' + clientName : 'Saved quote') +
            (projectDescription ? ' · ' + projectDescription.slice(0, 140) : ''),
          linkedView: 'quotes',
          snoozedUntil: null,
          sourceUpdatedAt: updatedAt,
        });
      }
    }

    if (record.kind === 'project') {
      const name = String(data.name || '').trim();
      const projectStatus =
        data.status === 'paused' || data.status === 'done' ? data.status : 'active';
      const lastActivity = projectActivity.get(id) || recordUpdatedAt(record);
      const age = now - lastActivity;

      if (name && projectStatus === 'active' && age >= STALLED_PROJECT_MS) {
        const daysQuiet = Math.max(14, Math.floor(age / DAY_MS));

        desired.push({
          title: 'Project may be stalled: ' + name.slice(0, 52),
          summary:
            'No saved activity has touched this active project for ' +
            daysQuiet +
            ' days.',
          status: 'open',
          priority: age >= VERY_STALLED_PROJECT_MS ? 'high' : 'medium',
          nextAction: 'Review the project, add the next step, pause it, or mark it done.',
          dueAt: null,
          source: 'workspace-project',
          sourceId: id,
          sourceExcerpt:
            'Active project: ' +
            name +
            (data.goal ? ' · Goal: ' + String(data.goal).slice(0, 150) : ''),
          linkedView: 'projects',
          snoozedUntil: null,
          sourceUpdatedAt: lastActivity,
        });
      }
    }
  }

  if (
    quoteDraft &&
    !quoteDraft.completedAt &&
    hasQuoteDraft(quoteDraft) &&
    now - Number(quoteDraft.updatedAt || now) >= ABANDONED_DRAFT_MS
  ) {
    const clientName = String(quoteDraft.clientName || '').trim();
    desired.push({
      title: clientName ? 'Finish quote draft for ' + clientName : 'Finish your quote draft',
      summary: 'A quote draft has been sitting unfinished for more than 30 minutes.',
      status: 'open',
      priority: now - Number(quoteDraft.updatedAt || now) >= DAY_MS ? 'medium' : 'low',
      nextAction: 'Open Quotes and finish, save, or discard the draft.',
      dueAt: null,
      source: 'workspace-draft',
      sourceId: 'work-quote',
      sourceExcerpt: String(
        quoteDraft.projectDescription ||
        quoteDraft.draft ||
        quoteDraft.notes ||
        'Unfinished quote draft'
      ).slice(0, 220),
      linkedView: 'quotes',
      snoozedUntil: null,
      sourceUpdatedAt: Number(quoteDraft.updatedAt || now),
    });
  }

  if (
    emailDraft &&
    !emailDraft.completedAt &&
    hasEmailDraft(emailDraft) &&
    now - Number(emailDraft.updatedAt || now) >= ABANDONED_DRAFT_MS
  ) {
    const recipient = String(emailDraft.to || emailDraft.recipient || '').trim();
    desired.push({
      title: recipient ? 'Finish email draft to ' + recipient : 'Finish your email draft',
      summary: 'An email draft has been sitting unfinished for more than 30 minutes.',
      status: 'open',
      priority: now - Number(emailDraft.updatedAt || now) >= DAY_MS ? 'medium' : 'low',
      nextAction: 'Open Email and finish, send, copy, or clear the draft.',
      dueAt: null,
      source: 'workspace-draft',
      sourceId: 'work-email',
      sourceExcerpt: String(
        emailDraft.subject ||
        emailDraft.request ||
        emailDraft.body ||
        'Unfinished email draft'
      ).slice(0, 220),
      linkedView: 'email',
      snoozedUntil: null,
      sourceUpdatedAt: Number(emailDraft.updatedAt || now),
    });
  }

  const managedSources = new Set([
    'workspace-task',
    'workspace-quote',
    'workspace-draft',
    'workspace-project',
  ]);
  const desiredByKey = new Map(
    desired.map((item) => [item.source + ':' + item.sourceId, item])
  );
  const existingByKey = new Map(
    existingLoops
      .filter((loop) => loop.source && loop.sourceId && managedSources.has(loop.source))
      .map((loop) => [loop.source + ':' + loop.sourceId, loop])
  );

  let changes = 0;

  for (const item of desired) {
    const key = item.source + ':' + item.sourceId;
    const existing = existingByKey.get(key);
    const {
      sourceUpdatedAt,
      ...payload
    } = item;

    if (!existing) {
      await firebaseBackend.createOpenLoop(payload);
      changes += 1;
      continue;
    }

    if (
      existing.status === 'resolved' &&
      sourceUpdatedAt > existing.updatedAt + 1000
    ) {
      await firebaseBackend.updateOpenLoop(existing.id, {
        ...payload,
        status: item.status,
        snoozedUntil: null,
      });
      changes += 1;
      continue;
    }

    if (existing.status !== 'resolved') {
      const changed =
        existing.title !== payload.title ||
        existing.summary !== payload.summary ||
        existing.priority !== payload.priority ||
        existing.status !== payload.status ||
        existing.waitingOn !== payload.waitingOn ||
        existing.nextAction !== payload.nextAction ||
        (existing.dueAt || null) !== (payload.dueAt || null) ||
        existing.sourceExcerpt !== payload.sourceExcerpt ||
        existing.linkedView !== payload.linkedView;

      if (changed) {
        await firebaseBackend.updateOpenLoop(existing.id, payload);
        changes += 1;
      }
    }
  }

  for (const loop of existingLoops) {
    if (
      !loop.source ||
      !loop.sourceId ||
      !managedSources.has(loop.source) ||
      loop.status === 'resolved'
    ) {
      continue;
    }

    const key = loop.source + ':' + loop.sourceId;
    if (!desiredByKey.has(key)) {
      await firebaseBackend.resolveOpenLoop(loop.id);
      changes += 1;
    }
  }

  return changes;
}

export default function LifeRadarPanel({
  userId,
  onNavigate,
}: LifeRadarPanelProps) {
  const [continuity, setContinuity] = useState<ContinuityState | null>(null);
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [status, setStatus] = useState('Connecting Life Radar…');

  useEffect(() => {
    let mounted = true;
    let unsubscribeLoops = () => {};
    let unsubscribeContinuity = () => {};
    let scanTimer: number | undefined;

    const runWorkspaceScan = async (currentLoops: OpenLoop[]) => {
      const changes = await syncWorkspaceRadar(currentLoops);
      if (!mounted) return currentLoops;

      const refreshed = changes
        ? await firebaseBackend.getOpenLoops(50)
        : currentLoops;

      if (mounted) {
        setLoops(refreshed);
        setStatus(
          changes
            ? 'Live across devices. Workspace Radar updated ' +
                changes +
                (changes === 1 ? ' item.' : ' items.')
            : 'Live across devices. Workspace scan is current.'
        );
      }

      return refreshed;
    };

    const connect = async () => {
      try {
        await firebaseBackend.initialize();

        const [initialContinuity, initialLoops] = await Promise.all([
          firebaseBackend.getContinuityState(),
          firebaseBackend.getOpenLoops(50),
        ]);

        if (!mounted) return;

        setContinuity(initialContinuity);
        await runWorkspaceScan(initialLoops);

        unsubscribeLoops = firebaseBackend.onOpenLoopsChange((next) => {
          if (mounted) setLoops(next);
        });

        unsubscribeContinuity = firebaseBackend.onContinuityStateChange((next) => {
          if (mounted) setContinuity(next);
        });

        scanTimer = window.setInterval(() => {
          void firebaseBackend
            .getOpenLoops(50)
            .then((current) => runWorkspaceScan(current))
            .catch((error) => {
              console.warn('Workspace Radar refresh skipped:', error);
            });
        }, 5 * 60 * 1000);
      } catch (error) {
        console.warn('Life Radar could not connect:', error);
        if (mounted) setStatus('Life Radar cloud sync is unavailable right now.');
      }
    };

    connect();

    return () => {
      mounted = false;
      unsubscribeLoops();
      unsubscribeContinuity();
      if (scanTimer) window.clearInterval(scanTimer);
    };
  }, [userId]);

  const activeLoops = useMemo(() => {
    const now = Date.now();

    return loops
      .filter((loop) => {
        if (loop.status === 'resolved') return false;
        if (
          loop.status === 'snoozed' &&
          loop.snoozedUntil &&
          loop.snoozedUntil > now
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const attentionWeight = (loop: OpenLoop) => {
          let weight = priorityWeight(loop.priority);

          if (loop.status === 'waiting') {
            const waitingAge = now - loop.createdAt;
            if (waitingAge >= 14 * DAY_MS) weight += 2;
            else if (waitingAge >= 7 * DAY_MS) weight += 1;
          }

          if (loop.dueAt && loop.dueAt < now) weight += 1;
          return weight;
        };

        const attentionDiff = attentionWeight(b) - attentionWeight(a);
        if (attentionDiff) return attentionDiff;
        return b.updatedAt - a.updatedAt;
      })
      .slice(0, 5);
  }, [loops]);

  const riskyCount = activeLoops.filter((loop) => {
    if (loop.priority === 'high') return true;
    if (loop.dueAt && loop.dueAt < Date.now()) return true;
    return loop.status === 'waiting' && Date.now() - loop.createdAt >= 7 * DAY_MS;
  }).length;
  const topPriority = activeLoops[0] || null;

  const resolve = async (id: string) => {
    try {
      await firebaseBackend.resolveOpenLoop(id);
    } catch (error) {
      console.warn('Could not resolve Life Radar item:', error);
    }
  };

  const snooze = async (id: string) => {
    try {
      await firebaseBackend.snoozeOpenLoop(
        id,
        Date.now() + 24 * 60 * 60 * 1000
      );
    } catch (error) {
      console.warn('Could not snooze Life Radar item:', error);
    }
  };

  const makeTask = async (loop: OpenLoop) => {
    try {
      const taskTitle = (loop.nextAction || loop.title).trim();
      if (!taskTitle) return;

      const dueDate = loop.dueAt
        ? new Date(loop.dueAt).toISOString().slice(0, 10)
        : '';

      const id = await firebaseBackend.saveBusinessRecord('task', {
        title: taskTitle,
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
        recordId: id,
        title: taskTitle,
      });

      await firebaseBackend.resolveOpenLoop(loop.id);
    } catch (error) {
      console.warn('Could not turn Life Radar item into a task:', error);
    }
  };

  const resume = () => {
    if (!continuity?.view) return;
    onNavigate(continuity.view);
  };

  return (
    <section className="radar-shell">
      <div className="radar-header">
        <div>
          <span className="kicker">LIFE RADAR</span>
          <h2>What am I forgetting?</h2>
          <p>{status}</p>
        </div>
        <div
          className="radar-score"
          aria-label={activeLoops.length + ' open loops'}
        >
          <strong>{activeLoops.length}</strong>
          <span>open loops</span>
          {riskyCount > 0 && (
            <small>{riskyCount} may become a problem</small>
          )}
        </div>
      </div>

      {topPriority && (
        <button
          className="top-priority-card"
          onClick={() => onNavigate(topPriority.linkedView || 'tasks')}
        >
          <div>
            <span>TOP PRIORITY</span>
            <strong>{topPriority.title}</strong>
            <small>
              {topPriority.nextAction || topPriority.summary || 'Handle this next.'}
            </small>
          </div>
          <b>Handle now →</b>
        </button>
      )}

      {continuity && continuity.view !== 'home' && (
        <button className="continuity-card" onClick={resume}>
          <div className="continuity-icon">↻</div>
          <div className="continuity-copy">
            <span className="continuity-kicker">
              PICK UP WHERE YOU LEFT OFF
            </span>
            <strong>{continuity.label}</strong>
            <small>
              {continuity.context ? continuity.context + ' · ' : ''}
              Last active {timeAgo(continuity.updatedAt)} on{' '}
              {deviceLabel(continuity.device)}
            </small>
          </div>
          <span className="continue-action">Continue →</span>
        </button>
      )}

      <div className="loop-list">
        {activeLoops.length === 0 ? (
          <div className="radar-clear">
            <div className="clear-mark">✓</div>
            <div>
              <strong>Radar is clear.</strong>
              <p>
                Radar scans Chat plus your workspace for unfinished commitments,
                due-soon tasks, stale quotes, stalled projects, and abandoned drafts.
              </p>
            </div>
            <button onClick={() => onNavigate('chat')}>
              Talk to Assistant
            </button>
          </div>
        ) : (
          activeLoops.map((loop) => {
            const sourceOpen = expandedSourceId === loop.id;
            const waitingDays =
              loop.status === 'waiting'
                ? Math.max(0, Math.floor((Date.now() - loop.createdAt) / DAY_MS))
                : 0;

            return (
              <article key={loop.id} className={'loop-card ' + loop.priority}>
                <div className="loop-main">
                  <div className="loop-state">
                    <span className={'priority-dot ' + loop.priority} />
                    {loop.status === 'waiting'
                      ? 'WAITING' + (waitingDays >= 1 ? ' · ' + waitingDays + 'D' : '')
                      : 'OPEN'}
                  </div>
                  <h3>{loop.title}</h3>
                  {loop.summary && (
                    <p className="loop-summary">{loop.summary}</p>
                  )}
                  {loop.waitingOn && (
                    <p className="waiting-on">
                      Waiting on <strong>{loop.waitingOn}</strong>
                    </p>
                  )}
                  {loop.nextAction && (
                    <p className="next-action">
                      <span>Next:</span> {loop.nextAction}
                    </p>
                  )}

                  {sourceOpen && loop.sourceExcerpt && (
                    <div className="source-box">
                      <span>WHY YOU&apos;RE SEEING THIS</span>
                      <p>“{loop.sourceExcerpt}”</p>
                    </div>
                  )}
                </div>

                <div className="loop-actions">
                  <button
                    className="handle"
                    onClick={() => onNavigate(loop.linkedView || 'tasks')}
                  >
                    Handle it
                  </button>
                  {loop.source !== 'workspace-task' && (
                    <button onClick={() => makeTask(loop)}>Make task</button>
                  )}
                  <button onClick={() => snooze(loop.id)}>Tomorrow</button>
                  <button onClick={() => resolve(loop.id)}>Resolve</button>
                  {loop.sourceExcerpt && (
                    <button
                      className="why"
                      onClick={() =>
                        setExpandedSourceId(sourceOpen ? null : loop.id)
                      }
                    >
                      {sourceOpen
                        ? 'Hide source'
                        : 'Why am I seeing this?'}
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <style jsx>{`
        .radar-shell {
          margin-top: 22px;
          padding: 20px;
          border: 1px solid #343434;
          border-radius: 20px;
          background:
            radial-gradient(circle at 92% 0%, rgba(99,210,151,.08), transparent 28%),
            #181818;
          box-shadow: 0 16px 42px rgba(0,0,0,.2);
        }
        .radar-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }
        .kicker, .continuity-kicker {
          color: #7f8d85;
          font-size: .62rem;
          letter-spacing: .14em;
          font-weight: 800;
        }
        h2 {
          margin: 5px 0 5px;
          font-size: 1.45rem;
          letter-spacing: -.03em;
        }
        .radar-header p {
          margin: 0;
          color: #6f6f6f;
          font-size: .67rem;
        }
        .radar-score {
          min-width: 128px;
          padding: 10px 12px;
          border-radius: 13px;
          border: 1px solid #343b37;
          background: rgba(35,43,39,.55);
          text-align: right;
        }
        .radar-score strong {
          display: block;
          font-size: 1.45rem;
          line-height: 1;
        }
        .radar-score span, .radar-score small {
          display: block;
          color: #7e8782;
          font-size: .59rem;
          margin-top: 4px;
        }
        .radar-score small { color: #d0a56b; }
        .top-priority-card {
          width: 100%;
          margin-top: 15px;
          padding: 13px 14px;
          border: 1px solid #4a4130;
          border-radius: 14px;
          background: rgba(72, 58, 34, .34);
          color: #eee;
          display: flex;
          justify-content: space-between;
          gap: 14px;
          align-items: center;
          text-align: left;
          cursor: pointer;
        }
        .top-priority-card:hover { background: rgba(82, 67, 40, .45); }
        .top-priority-card span,
        .top-priority-card strong,
        .top-priority-card small { display: block; }
        .top-priority-card span {
          color: #a99369;
          font-size: .55rem;
          letter-spacing: .13em;
          font-weight: 800;
        }
        .top-priority-card strong {
          margin-top: 4px;
          font-size: .8rem;
        }
        .top-priority-card small {
          margin-top: 4px;
          color: #8f8778;
          font-size: .62rem;
          line-height: 1.4;
        }
        .top-priority-card b {
          flex: 0 0 auto;
          color: #d7c59f;
          font-size: .64rem;
          white-space: nowrap;
        }
        .continuity-card {
          width: 100%;
          margin-top: 15px;
          padding: 13px 14px;
          border: 1px solid #3b4140;
          border-radius: 14px;
          background: #232726;
          color: #eee;
          display: grid;
          grid-template-columns: auto minmax(0,1fr) auto;
          align-items: center;
          gap: 12px;
          text-align: left;
          cursor: pointer;
        }
        .continuity-card:hover { background: #282d2b; }
        .continuity-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #303735;
          color: #8fcca9;
        }
        .continuity-copy strong, .continuity-copy small {
          display: block;
        }
        .continuity-copy strong {
          margin-top: 3px;
          font-size: .82rem;
        }
        .continuity-copy small {
          margin-top: 3px;
          color: #777f7b;
          font-size: .61rem;
        }
        .continue-action {
          color: #a9c2b3;
          font-size: .67rem;
          font-weight: 700;
        }
        .loop-list {
          display: grid;
          gap: 8px;
          margin-top: 12px;
        }
        .loop-card {
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 16px;
          padding: 14px;
          border: 1px solid #343434;
          border-radius: 14px;
          background: #242424;
        }
        .loop-card.high { border-color: #4a3c32; }
        .loop-state {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #737373;
          font-size: .55rem;
          letter-spacing: .11em;
          font-weight: 800;
        }
        .priority-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #777;
        }
        .priority-dot.high { background: #d89566; }
        .priority-dot.medium { background: #c5b36c; }
        .priority-dot.low { background: #73a98a; }
        h3 {
          margin: 7px 0 0;
          font-size: .86rem;
        }
        .loop-summary, .waiting-on, .next-action {
          margin: 5px 0 0;
          color: #858585;
          font-size: .66rem;
          line-height: 1.45;
        }
        .waiting-on strong { color: #b5b5b5; }
        .next-action span { color: #a7a7a7; font-weight: 700; }
        .source-box {
          margin-top: 10px;
          padding: 9px 10px;
          border-radius: 9px;
          background: #1d1d1d;
          border: 1px solid #303030;
        }
        .source-box span {
          color: #666;
          font-size: .53rem;
          letter-spacing: .12em;
          font-weight: 800;
        }
        .source-box p {
          margin: 5px 0 0;
          color: #8a8a8a;
          font-size: .62rem;
          line-height: 1.45;
        }
        .loop-actions {
          min-width: 128px;
          display: grid;
          gap: 6px;
          align-content: start;
        }
        .loop-actions button, .radar-clear button {
          min-height: 31px;
          padding: 0 10px;
          border: 1px solid #3b3b3b;
          border-radius: 8px;
          background: #2c2c2c;
          color: #9a9a9a;
          font-size: .59rem;
          cursor: pointer;
        }
        .loop-actions button:hover, .radar-clear button:hover {
          background: #333;
          color: #e8e8e8;
        }
        .loop-actions .handle {
          background: #ececec;
          border-color: #ececec;
          color: #111;
          font-weight: 750;
        }
        .loop-actions .why {
          background: transparent;
          border-color: transparent;
          color: #6f7d75;
          padding: 0;
          text-align: right;
        }
        .radar-clear {
          min-height: 92px;
          display: grid;
          grid-template-columns: auto minmax(0,1fr) auto;
          gap: 12px;
          align-items: center;
          padding: 12px 13px;
          border: 1px solid #303630;
          border-radius: 13px;
          background: #212421;
        }
        .clear-mark {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: #29352f;
          color: #7fd09f;
        }
        .radar-clear strong { font-size: .75rem; }
        .radar-clear p {
          margin: 4px 0 0;
          color: #707670;
          font-size: .62rem;
          line-height: 1.4;
        }
        @media (max-width: 720px) {
          .radar-shell { padding: 15px; }
          .radar-header { align-items: stretch; }
          .radar-score { min-width: 100px; }
          .continuity-card {
            grid-template-columns: auto minmax(0,1fr);
          }
          .continue-action {
            grid-column: 2;
          }
          .loop-card {
            grid-template-columns: 1fr;
          }
          .loop-actions {
            min-width: 0;
            grid-template-columns: repeat(3, 1fr);
          }
          .loop-actions .why {
            grid-column: 1 / -1;
            text-align: left;
          }
          .radar-clear {
            grid-template-columns: auto minmax(0,1fr);
          }
          .radar-clear button {
            grid-column: 2;
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}

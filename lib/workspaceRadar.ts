import { firebaseBackend, type OpenLoop } from './firebaseBackend';

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

export const DAY_MS = 24 * 60 * 60 * 1000;
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

export async function syncWorkspaceRadar(existingLoops: OpenLoop[]): Promise<number> {
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
      const snoozeIsActive =
        existing.status === 'snoozed' &&
        Boolean(existing.snoozedUntil && existing.snoozedUntil > now);

      const nextPayload = snoozeIsActive
        ? {
            ...payload,
            status: 'snoozed' as const,
            snoozedUntil: existing.snoozedUntil,
          }
        : payload;

      const changed =
        existing.title !== nextPayload.title ||
        existing.summary !== nextPayload.summary ||
        existing.priority !== nextPayload.priority ||
        existing.status !== nextPayload.status ||
        existing.waitingOn !== nextPayload.waitingOn ||
        existing.nextAction !== nextPayload.nextAction ||
        (existing.dueAt || null) !== (nextPayload.dueAt || null) ||
        existing.sourceExcerpt !== nextPayload.sourceExcerpt ||
        existing.linkedView !== nextPayload.linkedView ||
        (existing.snoozedUntil || null) !== (nextPayload.snoozedUntil || null);

      if (changed) {
        await firebaseBackend.updateOpenLoop(existing.id, nextPayload);
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



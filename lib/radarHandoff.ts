import { firebaseBackend, type OpenLoop } from './firebaseBackend';
import { suggestedRadarView } from './lifePreferences';

// "Handle it" on a Life Radar item should drop the user into the right tool with
// the right thing already loaded. Before this helper, every quote-ish item pasted
// its Radar title into the quote's "Project description" field, even when the
// item was literally "finish the quote draft you already have".
//
// Rules, in order:
// 1. Items that point at the working draft (work-quote / work-email) open the tool
//    with that draft intact. Any stale handoff is cleared so it cannot override it.
// 2. Items that point at a saved quote record load that quote (client, description,
//    items, notes) into the builder.
// 3. Everything else gets a light handoff: client name if we can read one from the
//    title, and the Radar context in notes/instructions, never in the description.

const WORKING_DRAFT_IDS = new Set(['work-quote', 'work-email']);

export function clientNameFromRadarTitle(title: string): string {
  const match = title.match(/\b(?:for|with|to|from)\s+([A-Z][\w'.-]*(?:\s+[A-Z][\w'.-]*){0,3})\s*$/);
  if (match) return match[1].trim();
  const loose = title.match(/\b(?:for|with|to|from)\s+([a-z][\w'.-]*(?:\s+[a-z][\w'.-]*){0,2})\s*$/i);
  if (!loose) return '';
  // Title-case names that were stored in lowercase ("allen hendershot").
  return loose[1]
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export type RadarHandoffResult = {
  view: string;
  mode: 'working-draft' | 'saved-record' | 'context' | 'none';
};

async function clearHandoff(kind: 'handoff-quote' | 'handoff-email', localKey: 'quote_draft' | 'email_draft'): Promise<void> {
  try { localStorage.removeItem(localKey); } catch { /* storage unavailable */ }
  await firebaseBackend.saveDraft(kind, { consumedAt: Date.now() }).catch(() => undefined);
}

async function findRecord(id: string): Promise<Record<string, unknown> | null> {
  const records = await firebaseBackend.getRecentBusinessRecords(250).catch(() => []);
  const match = records.find((record) => String(record.id || '') === id);
  return match ? ((match.data || {}) as Record<string, unknown>) : null;
}

export async function prepareRadarHandoff(loop: OpenLoop, userId: string): Promise<RadarHandoffResult> {
  const view = suggestedRadarView(loop);
  const context = loop.nextAction || loop.summary || loop.title;
  const sourceId = String(loop.sourceId || '');

  if (view === 'quotes') {
    if (loop.source === 'workspace-draft' && WORKING_DRAFT_IDS.has(sourceId)) {
      await clearHandoff('handoff-quote', 'quote_draft');
      return { view, mode: 'working-draft' };
    }

    if (loop.source === 'workspace-quote' && sourceId) {
      const data = await findRecord(sourceId);
      if (data) {
        const draft = {
          clientName: String(data.clientName || ''),
          projectDescription: String(data.projectDescription || ''),
          notes: String(data.notes || ''),
          items: Array.isArray(data.items) ? data.items : [],
          draft: typeof data.draft === 'string' ? data.draft : '',
          sourceRecordId: sourceId,
          sourceOpenLoopId: loop.id,
          updatedAt: Date.now(),
        };
        try { localStorage.setItem('quote_draft', JSON.stringify(draft)); } catch { /* ignore */ }
        await firebaseBackend.saveDraft('handoff-quote', draft).catch(() => undefined);
        return { view, mode: 'saved-record' };
      }
    }

    const draft = {
      clientName: clientNameFromRadarTitle(loop.title),
      notes: 'From Life Radar: ' + loop.title + (context && context !== loop.title ? '\n' + context : ''),
      sourceOpenLoopId: loop.id,
      updatedAt: Date.now(),
    };
    try { localStorage.setItem('quote_draft', JSON.stringify(draft)); } catch { /* ignore */ }
    await firebaseBackend.saveDraft('handoff-quote', draft).catch(() => undefined);
    return { view, mode: 'context' };
  }

  if (view === 'email') {
    if (loop.source === 'workspace-draft' && WORKING_DRAFT_IDS.has(sourceId)) {
      await clearHandoff('handoff-email', 'email_draft');
      return { view, mode: 'working-draft' };
    }
    const draft = {
      request: loop.title + (context && context !== loop.title ? '. ' + context : ''),
      sourceOpenLoopId: loop.id,
      updatedAt: Date.now(),
    };
    try { localStorage.setItem('email_draft', JSON.stringify(draft)); } catch { /* ignore */ }
    await firebaseBackend.saveDraft('handoff-email', draft).catch(() => undefined);
    return { view, mode: 'context' };
  }

  if (view === 'chat') {
    try { localStorage.setItem('assistant_launch_prompt:' + userId, context); } catch { /* ignore */ }
    return { view, mode: 'context' };
  }

  return { view, mode: 'none' };
}

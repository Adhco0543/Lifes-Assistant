import type { OpenLoop } from './firebaseBackend';

export const RADAR_DAY_MS = 24 * 60 * 60 * 1000;
export type RadarArchiveLoop = Pick<OpenLoop, 'id' | 'title' | 'createdAt' | 'status' | 'archived' | 'source' | 'linkedView' | 'userMarkedImportant' | 'priority' | 'dueAt'>;

export function isAllenQuoteLoop(loop: Pick<RadarArchiveLoop, 'title'>): boolean {
  return /allen\s+hendershot/i.test(loop.title) && /\bquote\b/i.test(loop.title);
}

export function isLegacyCodeReviewLoop(loop: Pick<RadarArchiveLoop, 'title'>): boolean {
  return /\b(?:review(?:\s+(?:the|my))?\s+code|github\s+repository|retriev(?:e|ing)\s+(?:the\s+|my\s+)?source\s+files?)\b/i.test(loop.title);
}

function isImportantWork(loop: RadarArchiveLoop, now: number): boolean {
  if (loop.userMarkedImportant || isAllenQuoteLoop(loop)) return true;
  if (loop.source === 'workspace-quote' || loop.source === 'workspace-draft' || loop.source === 'workspace-task') return true;
  if (loop.linkedView === 'quotes' || /\bquote\s+draft\b/i.test(loop.title)) return true;
  if (loop.dueAt && loop.dueAt >= now) return true;
  return false;
}

/** Selects reversible archive candidates without changing Firestore data. */
export function getRadarArchiveCandidates(loops: RadarArchiveLoop[], kind: 'code-review' | 'older', olderThanDays = 14, now = Date.now()): RadarArchiveLoop[] {
  const days = kind === 'code-review' ? 7 : olderThanDays;
  if (!Number.isInteger(days) || days < 1 || days > 3650) return [];
  const cutoff = now - days * RADAR_DAY_MS;
  return loops.filter(loop => {
    if (loop.archived || loop.status === 'resolved') return false;
    if (!Number.isFinite(loop.createdAt) || loop.createdAt >= cutoff) return false;
    if (isImportantWork(loop, now)) return false;
    if (kind === 'code-review') return isLegacyCodeReviewLoop(loop);
    return loop.priority !== 'high';
  });
}

export type RadarApiLoop = {
  title: string;
  summary?: string;
  status: 'open' | 'waiting';
  priority: 'low' | 'medium' | 'high';
  waitingOn?: string;
  nextAction?: string;
  linkedView?: string;
  dueDate?: string;
};

export type RadarApiResponse = {
  openLoops: RadarApiLoop[];
  resolveLoopIds: string[];
};

export function parseRadarApiResponse(value: unknown): RadarApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid Life Radar response.');
  }

  const record = value as Record<string, unknown>;
  if (record.openLoops !== undefined && !Array.isArray(record.openLoops)) {
    throw new Error('Invalid Life Radar response.');
  }
  if (record.resolveLoopIds !== undefined && !Array.isArray(record.resolveLoopIds)) {
    throw new Error('Invalid Life Radar response.');
  }

  const openLoops = (record.openLoops || []).slice(0, 20).flatMap((item): RadarApiLoop[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const loop = item as Record<string, unknown>;
    if (typeof loop.title !== 'string' || !loop.title.trim() || loop.title.length > 160) return [];
    if (loop.status !== 'open' && loop.status !== 'waiting') return [];
    if (loop.priority !== 'low' && loop.priority !== 'medium' && loop.priority !== 'high') return [];

    const result: RadarApiLoop = {
      title: loop.title.trim(),
      status: loop.status,
      priority: loop.priority,
    };
    for (const key of ['summary', 'waitingOn', 'nextAction', 'linkedView', 'dueDate'] as const) {
      const candidate = loop[key];
      if (typeof candidate === 'string' && candidate.length <= 240) result[key] = candidate;
    }
    if (result.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(result.dueDate)) delete result.dueDate;
    return [result];
  });

  const resolveLoopIds = (record.resolveLoopIds || [])
    .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120)
    .slice(0, 100);

  return { openLoops, resolveLoopIds };
}

/** Never throws: a malformed radar response falls back to an empty result. */
export function parseRadarApiResponseSafe(value: unknown): { response: RadarApiResponse; valid: boolean } {
  try {
    return { response: parseRadarApiResponse(value), valid: true };
  } catch {
    return { response: { openLoops: [], resolveLoopIds: [] }, valid: false };
  }
}

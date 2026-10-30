export type LifeMode = 'everyday' | 'business' | 'mix';
export type CapturePreference = 'chat' | 'voice' | 'forward' | '';

export const PRIMARY_SLIPS = [
  { id: 'followups', label: 'Follow-ups and replies', terms: ['follow-up', 'follow up', 'reply', 'email', 'waiting'] },
  { id: 'quotes', label: 'Quotes, invoices, or client work', terms: ['quote', 'invoice', 'client', 'customer'] },
  { id: 'appointments', label: 'Appointments and personal admin', terms: ['appointment', 'calendar', 'renewal', 'bill'] },
  { id: 'projects', label: 'Projects and next steps', terms: ['project', 'next step', 'task', 'deadline'] },
  { id: 'unsure', label: 'Not sure / a bit of everything', terms: [] },
] as const;

export type LifePreferences = {
  mode: LifeMode;
  primary_slips: string[];
  capture_pref: CapturePreference;
  important_signals?: string[];
  tool_overrides: { pinned: string[]; hidden: string[] };
};

export type StoredLifeProfile = {
  mode: LifeMode;
  primary_slips: string[];
  capture_pref: Exclude<CapturePreference, ''> | null;
  onboarding_completed_at: string;
  tool_overrides: { pinned: string[]; hidden: string[] };
};

export const DEFAULT_LIFE_PREFERENCES: LifePreferences = {
  mode: 'mix',
  primary_slips: [],
  capture_pref: '',
  important_signals: [],
  tool_overrides: { pinned: [], hidden: [] },
};

import { modeConfig } from './modeConfig';
export { modeConfig, getOrderedTools } from './modeConfig';

export const MODE_TOOL_ORDER: Record<LifeMode, string[]> = {
  everyday: modeConfig.everyday.toolOrder,
  business: modeConfig.business.toolOrder,
  mix: modeConfig.mix.toolOrder,
};
export const TRY_ASKING_BY_MODE: Record<LifeMode, string[]> = {
  everyday: modeConfig.everyday.examplePrompts,
  business: modeConfig.business.examplePrompts,
  mix: modeConfig.mix.examplePrompts,
};
export const MODE_PLACEHOLDERS: Record<LifeMode, string> = {
  everyday: modeConfig.everyday.placeholderText,
  business: modeConfig.business.placeholderText,
  mix: modeConfig.mix.placeholderText,
};

export function getVisibleTools<T extends { id: string }>(profile: Pick<LifePreferences, 'mode' | 'tool_overrides'>, tools: T[]): T[] {
  const hidden = new Set(profile.tool_overrides.hidden);
  const pinned = profile.tool_overrides.pinned.filter((id) => !hidden.has(id));
  const order = modeConfig[profile.mode].toolOrder;
  return tools.filter((tool) => !hidden.has(tool.id)).sort((a, b) => {
    const aPinned = pinned.indexOf(a.id);
    const bPinned = pinned.indexOf(b.id);
    if (aPinned >= 0 || bPinned >= 0) return aPinned < 0 ? 1 : bPinned < 0 ? -1 : aPinned - bPinned;
    const aOrder = order.indexOf(a.id);
    const bOrder = order.indexOf(b.id);
    return (aOrder < 0 ? Number.MAX_SAFE_INTEGER : aOrder) - (bOrder < 0 ? Number.MAX_SAFE_INTEGER : bOrder);
  });
}

export function suggestedRadarView(item: { title: string; summary?: string; nextAction?: string; linkedView?: string }): string {
  if (item.linkedView) return item.linkedView;
  const text = `${item.title} ${item.summary || ''} ${item.nextAction || ''}`.toLowerCase();
  if (/quote|invoice|estimate/.test(text)) return 'quotes';
  if (/email|follow.?up|reply|respond|call back/.test(text)) return 'email';
  if (/project|milestone/.test(text)) return 'projects';
  return 'tasks';
}

export function normalizeLifePreferences(value: unknown): LifePreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_LIFE_PREFERENCES;
  const record = value as Record<string, unknown>;
  const mode: LifeMode = record.mode === 'everyday' || record.mode === 'business' || record.mode === 'mix'
    ? record.mode
    : 'mix';
  const allowed = new Set<string>(PRIMARY_SLIPS.map((slip) => slip.id));
  const selectedSlips = Array.isArray(record.primary_slips)
    ? [...new Set(record.primary_slips.filter((item): item is string => typeof item === 'string' && allowed.has(item)))]
    : [];
  const primary_slips = selectedSlips.includes('unsure') ? ['unsure'] : selectedSlips.slice(0, 3);
  const capture_pref: CapturePreference = record.capture_pref === 'chat' || record.capture_pref === 'voice' || record.capture_pref === 'forward'
    ? record.capture_pref
    : '';
  const important_signals = Array.isArray(record.important_signals)
    ? [...new Set(record.important_signals.filter((item): item is string => typeof item === 'string' && item.length <= 80))]
    : [];
  const overrides = record.tool_overrides && typeof record.tool_overrides === 'object'
    ? record.tool_overrides as Record<string, unknown>
    : {};
  const availableTools = new Set(Object.values(MODE_TOOL_ORDER).flat());
  const normalizeTools = (items: unknown) => Array.isArray(items)
    ? [...new Set(items.filter((item): item is string => typeof item === 'string' && availableTools.has(item)))]
    : [];
  const tool_overrides = { pinned: normalizeTools(overrides.pinned), hidden: normalizeTools(overrides.hidden) };
  return { mode, primary_slips, capture_pref, important_signals, tool_overrides };
}

export function buildLifeProfileDocument(
  value: Record<string, unknown>,
  previous: Record<string, unknown> = {},
  now = new Date().toISOString()
): StoredLifeProfile {
  const source = { ...previous, ...value };
  const normalized = normalizeLifePreferences(source);
  const rawTime = typeof value.onboarding_completed_at === 'string'
    ? value.onboarding_completed_at
    : previous.onboarding_completed_at;
  const parsedTime = typeof rawTime === 'string' ? Date.parse(rawTime) : Number.NaN;
  const overrides = source.tool_overrides && typeof source.tool_overrides === 'object'
    ? source.tool_overrides as Record<string, unknown>
    : {};
  const rawCapture = Object.prototype.hasOwnProperty.call(value, 'capture_pref')
    ? value.capture_pref
    : previous.capture_pref;

  return {
    mode: normalized.mode,
    primary_slips: normalized.primary_slips,
    capture_pref: rawCapture === 'chat' || rawCapture === 'voice' || rawCapture === 'forward' ? rawCapture : null,
    onboarding_completed_at: Number.isFinite(parsedTime) ? new Date(parsedTime).toISOString() : now,
    tool_overrides: normalized.tool_overrides,
  };
}

export function explainRadarItem(
  item: { title: string; summary?: string; source?: string; linkedView?: string; status?: string; priority?: string; nextAction?: string; createdAt?: number; updatedAt?: number; dueAt?: number | null; userMarkedImportant?: boolean },
  preferences: LifePreferences,
  now = Date.now()
): string[] {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''} ${item.linkedView || ''}`.toLowerCase();
  const reasons: string[] = [];
  const ageDays = item.createdAt ? Math.floor(Math.max(0, now - item.createdAt) / (24 * 60 * 60 * 1000)) : 0;
  if (item.dueAt && item.dueAt <= now) reasons.push('Its due date has passed.');
  else if (item.status === 'waiting' && ageDays >= 7) reasons.push(`It has been waiting for ${ageDays} days.`);
  else if (ageDays >= 7) reasons.push(`It has been open for ${ageDays} days.`);
  if (item.nextAction?.trim()) reasons.push('There is a clear next step.');
  if (item.userMarkedImportant) reasons.push('You marked this as important.');
  if (preferences.important_signals?.includes(`view:${item.linkedView}`) && item.linkedView) reasons.push('You marked similar items as important.');
  const matches = PRIMARY_SLIPS.filter(slip => preferences.primary_slips.includes(slip.id) && slip.terms.some(term => text.includes(term)));
  if (matches.length) reasons.push(`Matches your priority: ${matches.map(item => item.label).join(', ')}.`);
  const modeWeights = modeConfig[preferences.mode].radarWeights;
  const modeType = /quote|invoice|estimate/.test(text) ? 'quote'
    : /client|customer/.test(text) ? 'client_followup'
    : /project|milestone/.test(text) ? 'project'
    : /material|room/.test(text) ? 'material'
    : /appointment|bill|renewal|personal|calendar/.test(text) ? 'appointment'
    : /follow.?up|reply|email|waiting/.test(text) ? 'personal_followup'
    : 'other';
  if (modeWeights[modeType] > 1) reasons.push('Ranked higher for your ' + preferences.mode + ' mode.');
  else if (modeWeights[modeType] < 1) reasons.push('Ranked lower for your ' + preferences.mode + ' mode, so mode-specific work can rise above it.');
  if (!reasons.length) reasons.push('Radar found this in your saved workspace and ranked it by age and current status.');
  return reasons.slice(0, 3);
}

export function scoreRadarItem(
  item: { title: string; summary?: string; source?: string; linkedView?: string; status?: string; priority?: string; nextAction?: string; createdAt?: number; updatedAt?: number; dueAt?: number | null; userMarkedImportant?: boolean },
  preferences: LifePreferences,
  now = Date.now()
): number {
  const text = `${item.title} ${item.summary || ''} ${item.source || ''} ${item.linkedView || ''}`.toLowerCase();
  const ageDays = item.createdAt ? Math.max(0, (now - item.createdAt) / (24 * 60 * 60 * 1000)) : 0;
  const risk = item.priority === 'high' || Boolean(item.dueAt && item.dueAt <= now) || (item.status === 'waiting' && ageDays >= 7) || Boolean(item.linkedView && preferences.important_signals?.includes(`view:${item.linkedView}`));
  let score = ageDays * 0.4 + (risk ? 20 : 0) + (item.nextAction?.trim() ? 10 : 0);
  if (item.updatedAt && now - item.updatedAt <= 48 * 60 * 60 * 1000) score += 3;
  if (item.userMarkedImportant) score += 20;
  if (item.linkedView && preferences.important_signals?.includes(`view:${item.linkedView}`)) score += 20;
  let type: 'personal_followup' | 'appointment' | 'quote' | 'client_followup' | 'project' | 'material' | 'other' = 'other';
  if (/appointment|bill|renewal|personal|calendar/.test(text)) type = 'appointment';
  else if (/quote|invoice/.test(text)) type = 'quote';
  else if (/client|customer/.test(text)) type = 'client_followup';
  else if (/project|estimate/.test(text)) type = 'project';
  else if (/material|spatial|room/.test(text)) type = 'material';
  else if (/follow-up|follow up|reply|email|waiting/.test(text)) type = 'personal_followup';
  score *= modeConfig[preferences.mode].radarWeights[type];

  if (preferences.primary_slips.includes('unsure')) score += 15;
  for (const slip of PRIMARY_SLIPS) {
    if (preferences.primary_slips.includes(slip.id) && slip.terms.some((term) => text.includes(term))) {
      score += 15;
    }
  }
  return score;
}

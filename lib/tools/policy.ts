// Autonomy policy: decides, before any tool runs, whether Bella may act on her
// own, must ask first, or must not act at all. Pure and synchronous so it can be
// unit-tested without Firestore or a model.

export type ToolDecision = 'allow' | 'approval_required' | 'blocked';

/**
 * How far-reaching an action is. This is the main input to the policy.
 * - workspace: writes inside the user's own workspace (tasks, notes, memory). Reversible.
 * - draft: prepares something for the user to review. Never leaves the workspace.
 * - external: reaches another person or system (sending an email). Not reversible.
 * - read: no side effects.
 */
export type ActionClass = 'read' | 'workspace' | 'draft' | 'external';

/** Subset of AutonomySettings the policy actually reads. Everything is optional so
 *  partial or legacy documents still work. */
export interface PolicySettings {
  emailBehavior?: 'ask' | 'draft_only' | 'auto_send' | string;
  emailCategories?: Record<string, 'ask' | 'auto_draft' | 'auto_send' | string>;
  autoSendQuotesUnder?: number;
  requireConfirmationForLargeAmounts?: number;
  dailyExecutionLimit?: number;
  requiresApprovalForTasks?: string[];
  autoTaskTypes?: string[];
  autoApproveTrustedCustomers?: boolean;
  trustedCustomers?: string[];
  disableDuringHours?: { enabled?: boolean; startTime?: string; endTime?: string };
}

export interface PolicyContext {
  /** The tool's action class. */
  actionClass: ActionClass;
  /** Short category used by requiresApprovalForTasks/autoTaskTypes (e.g. "email", "quote"). */
  taskType?: string;
  /** For email tools: customer | followup | invoice. */
  emailCategory?: string;
  /** Dollar amount attached to the action, if any. */
  amount?: number;
  /** Recipient (email or name) for external actions. */
  recipient?: string;
  /** Tool executions already recorded today. */
  executedToday: number;
  /** Local time of day for the user, minutes since midnight. */
  localMinutes: number;
  /** True when no human is in the loop (scheduled runs). */
  background?: boolean;
}

export interface PolicyResult {
  decision: ToolDecision;
  /** Short, user-facing reason. Shown on receipts and approval cards. */
  reason: string;
  /** Machine-readable code, stable for tests and analytics. */
  code:
    | 'read_only'
    | 'workspace_write'
    | 'draft_only'
    | 'daily_limit'
    | 'quiet_hours'
    | 'requires_approval_list'
    | 'email_ask'
    | 'email_draft'
    | 'email_auto'
    | 'large_amount'
    | 'trusted_recipient'
    | 'background_draft_only'
    | 'unknown_external';
}

export function parseClock(value: string | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** True when localMinutes falls inside [start, end), handling overnight windows like 18:00–08:00. */
export function isWithinQuietHours(settings: PolicySettings, localMinutes: number): boolean {
  const window = settings.disableDuringHours;
  if (!window || !window.enabled) return false;
  const start = parseClock(window.startTime);
  const end = parseClock(window.endTime);
  if (start === null || end === null || start === end) return false;
  if (start < end) return localMinutes >= start && localMinutes < end;
  return localMinutes >= start || localMinutes < end;
}

/** Minutes since local midnight for a given instant and IANA time zone. */
export function localMinutesFor(date: Date, timeZone: string | undefined): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
    return hour * 60 + minute;
  } catch {
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

function normalizeList(list: string[] | undefined): string[] {
  return (list || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function recipientIsTrusted(settings: PolicySettings, recipient: string | undefined): boolean {
  if (!settings.autoApproveTrustedCustomers || !recipient) return false;
  const needle = recipient.trim().toLowerCase();
  return normalizeList(settings.trustedCustomers).some((entry) => entry && (needle === entry || needle.includes(entry)));
}

export function decide(settings: PolicySettings, context: PolicyContext): PolicyResult {
  // Reads never need permission and never count against limits.
  if (context.actionClass === 'read') {
    return { decision: 'allow', code: 'read_only', reason: 'Read-only lookup.' };
  }

  // Hard daily ceiling on everything that writes.
  const limit = Number(settings.dailyExecutionLimit);
  if (Number.isFinite(limit) && limit > 0 && context.executedToday >= limit) {
    return {
      decision: 'blocked',
      code: 'daily_limit',
      reason: 'Daily action limit of ' + limit + ' reached. Raise it in Settings → Autonomy, or do this one by hand.',
    };
  }

  // Internal, reversible writes that the user asked for in conversation.
  if (context.actionClass === 'workspace') {
    return { decision: 'allow', code: 'workspace_write', reason: 'Saved in your workspace. You can edit or delete it anytime.' };
  }

  if (context.actionClass === 'draft') {
    return { decision: 'allow', code: 'draft_only', reason: 'Draft only. Nothing was sent.' };
  }

  // ---- External actions -------------------------------------------------
  if (isWithinQuietHours(settings, context.localMinutes)) {
    return {
      decision: 'approval_required',
      code: 'quiet_hours',
      reason: 'Inside your quiet hours, so this waits for your OK.',
    };
  }

  if (context.background) {
    return {
      decision: 'approval_required',
      code: 'background_draft_only',
      reason: 'Prepared while you were away. Nothing external is sent without you.',
    };
  }

  const taskType = (context.taskType || '').toLowerCase();
  if (taskType && normalizeList(settings.requiresApprovalForTasks).includes(taskType)) {
    return {
      decision: 'approval_required',
      code: 'requires_approval_list',
      reason: 'Your settings always ask before ' + taskType + ' actions.',
    };
  }

  const threshold = Number(settings.requireConfirmationForLargeAmounts);
  if (typeof context.amount === 'number' && Number.isFinite(threshold) && threshold > 0 && context.amount > threshold) {
    return {
      decision: 'approval_required',
      code: 'large_amount',
      reason: 'Over your $' + threshold + ' confirmation threshold.',
    };
  }

  if (taskType === 'email') {
    const category = (context.emailCategory || '').toLowerCase();
    const categoryBehavior = category ? settings.emailCategories?.[category] : undefined;
    const behavior = categoryBehavior || settings.emailBehavior || 'ask';
    if (behavior === 'auto_send') {
      return { decision: 'allow', code: 'email_auto', reason: 'Auto-send is on for ' + (category || 'email') + '.' };
    }
    if (recipientIsTrusted(settings, context.recipient)) {
      return { decision: 'allow', code: 'trusted_recipient', reason: 'Trusted contact. Auto-approved per your settings.' };
    }
    if (behavior === 'draft_only' || behavior === 'auto_draft') {
      return { decision: 'approval_required', code: 'email_draft', reason: 'Your settings say draft only. Review and send when ready.' };
    }
    return { decision: 'approval_required', code: 'email_ask', reason: 'Your settings ask before sending email.' };
  }

  if (taskType && normalizeList(settings.autoTaskTypes).includes(taskType)) {
    return { decision: 'allow', code: 'email_auto', reason: 'Auto-execute is on for ' + taskType + '.' };
  }

  return { decision: 'approval_required', code: 'unknown_external', reason: 'External action. Waiting for your OK.' };
}

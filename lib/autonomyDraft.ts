import type { AutonomySettings } from './autonomySettings';

// Pure mapping between the Autonomy settings document and the small form the
// Settings page shows. Kept free of React and Firebase so it can be unit-tested.

export type EmailMode = 'ask' | 'draft_only' | 'auto_send';
export type CategoryMode = 'ask' | 'auto_draft' | 'auto_send';

export type AutonomyDraft = {
  emailMode: EmailMode;
  categories: { customer: CategoryMode; followup: CategoryMode; invoice: CategoryMode };
  confirmOver: string;
  dailyLimit: string;
  quietEnabled: boolean;
  quietStart: string;
  quietEnd: string;
};

export const CATEGORY_LABELS: Array<{ id: keyof AutonomyDraft['categories']; label: string; hint: string }> = [
  { id: 'followup', label: 'Follow-ups', hint: 'Checking in after a quote or a quiet week.' },
  { id: 'customer', label: 'Customer replies', hint: 'Answers to questions, scheduling, confirmations.' },
  { id: 'invoice', label: 'Invoices and payment', hint: 'Anything that mentions money owed.' },
];

export function toAutonomyDraft(settings: AutonomySettings): AutonomyDraft {
  return {
    emailMode: settings.emailBehavior || 'ask',
    categories: {
      customer: settings.emailCategories?.customer || 'ask',
      followup: settings.emailCategories?.followup || 'ask',
      invoice: settings.emailCategories?.invoice || 'ask',
    },
    confirmOver: String(settings.requireConfirmationForLargeAmounts ?? 0),
    dailyLimit: String(settings.dailyExecutionLimit ?? 50),
    quietEnabled: Boolean(settings.disableDuringHours?.enabled),
    quietStart: settings.disableDuringHours?.startTime || '20:00',
    quietEnd: settings.disableDuringHours?.endTime || '07:00',
  };
}

export function toAutonomySettings(draft: AutonomyDraft, current: AutonomySettings): Partial<AutonomySettings> {
  // The policy treats anything in requiresApprovalForTasks as "always ask", so the
  // email entry has to follow the email mode or auto-send could never take effect.
  const approvalList = new Set((current.requiresApprovalForTasks || []).map((item) => String(item).toLowerCase()));
  if (draft.emailMode === 'auto_send') approvalList.delete('email');
  else approvalList.add('email');

  const confirmOver = Math.max(0, Math.round(Number(draft.confirmOver) || 0));
  const dailyLimit = Math.max(0, Math.round(Number(draft.dailyLimit) || 0));

  return {
    emailBehavior: draft.emailMode,
    emailCategories: draft.emailMode === 'auto_send'
      ? draft.categories
      : { customer: 'ask', followup: 'ask', invoice: 'ask' },
    requiresApprovalForTasks: Array.from(approvalList),
    requireConfirmationForLargeAmounts: confirmOver,
    dailyExecutionLimit: dailyLimit,
    disableDuringHours: {
      enabled: draft.quietEnabled,
      startTime: draft.quietStart,
      endTime: draft.quietEnd,
    },
  };
}

function clockLabel(value: string): string {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return twelve + ':' + match[2] + ' ' + suffix;
}

export function describeAutonomyDraft(draft: AutonomyDraft): string[] {
  const lines: string[] = [];
  if (draft.emailMode === 'ask') lines.push('Bella always asks before any email goes out.');
  else if (draft.emailMode === 'draft_only') lines.push('Bella writes emails and parks them as drafts; you press send.');
  else {
    const auto = CATEGORY_LABELS.filter((c) => draft.categories[c.id] === 'auto_send').map((c) => c.label.toLowerCase());
    lines.push(auto.length ? 'Bella can send ' + auto.join(', ') + ' on her own. Everything else waits for you.' : 'Auto-send is on, but no category is allowed yet, so everything still waits for you.');
  }
  const over = Number(draft.confirmOver) || 0;
  if (over > 0) lines.push('Anything over $' + over.toLocaleString() + ' always asks first.');
  const limit = Number(draft.dailyLimit) || 0;
  lines.push(limit > 0 ? 'At most ' + limit + ' assistant actions per day.' : 'No daily cap on assistant actions.');
  if (draft.quietEnabled) lines.push('Nothing external between ' + clockLabel(draft.quietStart) + ' and ' + clockLabel(draft.quietEnd) + ' without your OK.');
  return lines;
}


import type { LifeMode } from './lifePreferences';

export const modeConfig: Record<LifeMode, {toolOrder: string[]; examplePrompts: string[]; radarWeights: Record<string, number>; placeholderText: string}> = {
  everyday: {
    toolOrder: ['radar','chat','tasks','people','memory','brief','search','email','projects','quotes'],
    examplePrompts: ['Help me plan everything I need to get done tomorrow.','What am I forgetting this week?','Remind me to renew car registration.','Draft a follow-up and let me approve it before anything is sent.'],
    radarWeights: {personal_followup:1.4,appointment:1.5,quote:0.6,client_followup:0.7,project:1.0,material:1,other:1},
    placeholderText: 'Remind me to… or what am I forgetting?',
  },
  business: {
    toolOrder: ['radar','chat','quotes','email','tasks','people','memory','brief','search','projects'],
    examplePrompts: ['Turn these rough notes into a professional quote.','Follow up on the unfinished quote for Allen.','Break this project into steps and tell me what I should do first.','Draft a follow-up email and let me approve it.'],
    radarWeights: {personal_followup:1.2,appointment:0.7,quote:1.6,client_followup:1.5,project:1.3,material:1,other:1},
    placeholderText: 'Turn these notes into a quote or follow up on…',
  },
  mix: {
    toolOrder: ['radar','chat','tasks','email','quotes','people','memory','brief','search','projects'],
    examplePrompts: ['What am I forgetting?','Turn these notes into a quote.','Help me plan tomorrow.','Draft a follow-up email.'],
    radarWeights: {personal_followup:1.2,appointment:1.1,quote:1.2,client_followup:1.2,project:1.1,material:1,other:1},
    placeholderText: 'What am I forgetting, or what should I do next?',
  },
};

export function getOrderedTools(profile: {mode?: LifeMode;tool_overrides?: {pinned?: string[];hidden?: string[]}} | null | undefined): string[] {
  const config = modeConfig[profile?.mode || 'mix'];
  const hidden = new Set(profile?.tool_overrides?.hidden || []);
  const pinned = (profile?.tool_overrides?.pinned || []).filter(id => !hidden.has(id) && config.toolOrder.includes(id));
  return [...new Set([...pinned, ...config.toolOrder.filter(id => !hidden.has(id))])];
}

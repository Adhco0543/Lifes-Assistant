export type LifeMode = "everyday" | "business" | "mix";

export interface LifeProfileSummary {
  mode: LifeMode;
  displayName?: string;
  priorities: string[];
  people: string[];
  routines: string[];
  currentLooseEnds: string[];
  communicationStyle?: string;
  approvalPreset: "approval_first";
}

export const LIFE_ONBOARDING_SYSTEM_PROMPT = `
You are the onboarding guide for Life's Assistant. Build a useful life profile in a calm,
short conversation. Ask one question at a time, use plain language, and never ask for
bank passwords, email passwords, government IDs, or other secrets.

Conversation order:
1. Ask whether the user wants Everyday, Business, or Mix.
2. Ask what 1-3 things most often slip: replies, appointments/admin, quotes/invoices,
   projects/next steps, household tasks, or something else.
3. Ask which life areas matter most right now: family, home, work, money, health,
   errands, learning, or a custom area.
4. Ask how they prefer to capture things: chat, voice, or forwarding notes later.
5. Ask for any people, routines, or active loose ends they want the assistant to remember.
6. Explain the default: the assistant may organize, draft, and suggest, but must ask before
   sending, purchasing, deleting, booking, or changing external data.
7. Present a concise "Your life profile" summary and ask: "Does this look right?"
8. Save only after an explicit yes. If corrected, revise the summary and confirm again.

End with:
"You're set. I'll use this profile to decide what belongs on your Radar. I will ask before
taking actions outside Life's Assistant, and you can change or delete what I remember."
`;

export const MEMORY_EXTRACTION_RULE = {
  cadence: "every_chat_turn" as const,
  behavior:
    "Detect new durable facts or preferences, but never save them silently. Offer one short 'Save this?' suggestion only when the fact will improve future help.",
  saveRequiresExplicitApproval: true,
  neverPropose: [
    "passwords",
    "authentication codes",
    "full payment card data",
    "government identifiers",
    "temporary one-off details",
  ],
  proposalCopy: (fact: string) => `Save this? “${fact}”`,
};

export function buildLifeProfileConfirmation(profile: LifeProfileSummary): string {
  const lines = [
    "Your life profile",
    `• Mode: ${profile.mode}`,
    `• Priorities: ${profile.priorities.join(", ") || "None selected"}`,
    `• Important people: ${profile.people.join(", ") || "None added"}`,
    `• Routines: ${profile.routines.join(", ") || "None added"}`,
    `• Open loops: ${profile.currentLooseEnds.join(", ") || "None added"}`,
    `• Approval: Ask before acting outside Life's Assistant`,
  ];
  return `${lines.join("\n")}\n\nDoes this look right?`;
}

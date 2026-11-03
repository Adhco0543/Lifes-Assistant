import type { LifeProfileSummary } from "./onboardingConversation";
import { onboardingIsComplete } from "./onboardingConversation";
import type { UserMemoryProfile } from "./userMemoryProfile";

export function seedUserMemoryFromOnboarding(
  userId: string,
  summary: LifeProfileSummary,
  confirmedByUser: boolean,
  now = new Date().toISOString()
): UserMemoryProfile {
  if (!onboardingIsComplete(summary, confirmedByUser)) {
    throw new Error("Life profile must be complete and confirmed before it can be saved.");
  }

  return {
    userId,
    mode: summary.mode,
    primarySlips: [],
    capturePreference: null,
    communicationStyle: summary.communicationStyle
      ? { tone: summary.communicationStyle }
      : undefined,
    lifeDomains: summary.priorities.map((label, index) => ({
      id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      priority: Math.min(index + 1, 5) as 1 | 2 | 3 | 4 | 5,
      autonomy: summary.domainAutonomy[label] || "draft_then_ask",
      goals: [],
      activeLoops: summary.currentLooseEnds,
      updatedAt: now,
    })),
    importantPeople: summary.people.map((person, index) => ({
      id: `person-${index + 1}`,
      name: person.name,
      handlingPreferences: person.handlingPreferences,
    })),
    rememberedFacts: [],
    neverDo: summary.neverDo,
    standingPermissions: Object.entries(summary.domainAutonomy)
      .filter(([, autonomy]) => autonomy === "standing_permission")
      .map(([domain]) => domain),
    approvalPreset: "approval_first",
    onboardingConfirmedAt: now,
    updatedAt: now,
  };
}

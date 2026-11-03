import type { LifeMode } from "./onboardingConversation";

export type LifeDomainId =
  | "family"
  | "home"
  | "work"
  | "money"
  | "health"
  | "errands"
  | "learning"
  | string;

export type DomainAutonomy = "suggest_only" | "draft_then_ask" | "standing_permission";

export interface LifeDomain {
  id: LifeDomainId;
  label: string;
  priority: 1 | 2 | 3 | 4 | 5;
  autonomy: DomainAutonomy;
  goals: string[];
  activeLoops: string[];
  notes?: string;
  updatedAt: string;
}

export interface ImportantPerson {
  id: string;
  name: string;
  relationship?: string;
  handlingPreferences: string[];
  notes?: string;
}

export interface RememberedFact {
  id: string;
  value: string;
  category: "preference" | "person" | "routine" | "context" | "goal";
  source: "onboarding" | "chat" | "manual";
  confirmedByUser: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserMemoryProfile {
  userId: string;
  mode: LifeMode;
  primarySlips: string[];
  capturePreference: "chat" | "voice" | "forward" | null;
  communicationStyle?: {
    tone?: string;
    detailLevel?: "short" | "balanced" | "detailed";
  };
  lifeDomains: LifeDomain[];
  importantPeople: ImportantPerson[];
  rememberedFacts: RememberedFact[];
  neverDo: string[];
  standingPermissions: string[];
  approvalPreset: "approval_first";
  onboardingConfirmedAt?: string;
  updatedAt: string;
}

export const EMPTY_USER_MEMORY_PROFILE: Omit<UserMemoryProfile, "userId"> = {
  mode: "mix",
  primarySlips: [],
  capturePreference: null,
  lifeDomains: [],
  importantPeople: [],
  rememberedFacts: [],
  neverDo: [],
  standingPermissions: [],
  approvalPreset: "approval_first",
  updatedAt: new Date(0).toISOString(),
};

export function migrateUserMemoryProfile(
  userId: string,
  input: Partial<UserMemoryProfile> | null | undefined
): UserMemoryProfile {
  return {
    ...EMPTY_USER_MEMORY_PROFILE,
    ...input,
    userId,
    mode: input?.mode || "mix",
    primarySlips: Array.isArray(input?.primarySlips) ? input.primarySlips : [],
    lifeDomains: Array.isArray(input?.lifeDomains) ? input.lifeDomains.map((domain) => ({
      ...domain,
      autonomy: domain.autonomy || "draft_then_ask",
    })) : [],
    importantPeople: Array.isArray(input?.importantPeople) ? input.importantPeople : [],
    rememberedFacts: Array.isArray(input?.rememberedFacts) ? input.rememberedFacts : [],
    neverDo: Array.isArray(input?.neverDo) ? input.neverDo : [],
    standingPermissions: Array.isArray(input?.standingPermissions) ? input.standingPermissions : [],
    approvalPreset: "approval_first",
    updatedAt: input?.updatedAt || new Date().toISOString(),
  };
}

export function upsertLifeDomain(
  profile: UserMemoryProfile,
  domain: LifeDomain
): UserMemoryProfile {
  const lifeDomains = profile.lifeDomains.some((item) => item.id === domain.id)
    ? profile.lifeDomains.map((item) => (item.id === domain.id ? domain : item))
    : [...profile.lifeDomains, domain];

  return { ...profile, lifeDomains, updatedAt: new Date().toISOString() };
}

export function addConfirmedMemory(
  profile: UserMemoryProfile,
  fact: RememberedFact
): UserMemoryProfile {
  if (!fact.confirmedByUser) return profile;
  return {
    ...profile,
    rememberedFacts: [...profile.rememberedFacts, fact],
    updatedAt: new Date().toISOString(),
  };
}

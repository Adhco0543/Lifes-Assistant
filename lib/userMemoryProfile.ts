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

export interface LifeDomain {
  id: LifeDomainId;
  label: string;
  priority: 1 | 2 | 3 | 4 | 5;
  goals: string[];
  activeLoops: string[];
  notes?: string;
  updatedAt: string;
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
  rememberedFacts: RememberedFact[];
  approvalPreset: "approval_first";
  onboardingConfirmedAt?: string;
  updatedAt: string;
}

export const EMPTY_USER_MEMORY_PROFILE: Omit<UserMemoryProfile, "userId"> = {
  mode: "mix",
  primarySlips: [],
  capturePreference: null,
  lifeDomains: [],
  rememberedFacts: [],
  approvalPreset: "approval_first",
  updatedAt: new Date(0).toISOString(),
};

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

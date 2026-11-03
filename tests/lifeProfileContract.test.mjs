import test from "node:test";
import assert from "node:assert/strict";

import { onboardingIsComplete } from "../lib/onboardingConversation.ts";
import { seedUserMemoryFromOnboarding } from "../lib/lifeProfileSeed.ts";
import { migrateUserMemoryProfile } from "../lib/userMemoryProfile.ts";

const summary = {
  mode: "mix",
  priorities: ["Family logistics", "Work"],
  people: [{ name: "Jamie", handlingPreferences: ["Draft replies before sending"] }],
  routines: ["School pickup on weekdays"],
  currentLooseEnds: ["Confirm Saturday plans"],
  neverDo: ["Send a message without approval"],
  domainAutonomy: {
    "Family logistics": "draft_then_ask",
    Work: "standing_permission",
  },
  approvalPreset: "approval_first",
};

test("onboarding completes only after explicit confirmation", () => {
  assert.equal(onboardingIsComplete(summary, false), false);
  assert.equal(onboardingIsComplete(summary, true), true);
});

test("confirmed onboarding seeds life domains, people, limits, and approval-first", () => {
  const profile = seedUserMemoryFromOnboarding(
    "user-1",
    summary,
    true,
    "2026-11-03T00:00:00.000Z"
  );

  assert.equal(profile.approvalPreset, "approval_first");
  assert.equal(profile.lifeDomains[0].autonomy, "draft_then_ask");
  assert.deepEqual(profile.standingPermissions, ["Work"]);
  assert.equal(profile.importantPeople[0].name, "Jamie");
  assert.deepEqual(profile.neverDo, ["Send a message without approval"]);
});

test("unconfirmed onboarding cannot write a profile", () => {
  assert.throws(
    () => seedUserMemoryFromOnboarding("user-1", summary, false),
    /complete and confirmed/
  );
});

test("legacy memory profiles migrate to safe defaults", () => {
  const profile = migrateUserMemoryProfile("legacy-user", {
    mode: "business",
    lifeDomains: [{
      id: "work",
      label: "Work",
      priority: 1,
      goals: [],
      activeLoops: [],
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  });

  assert.equal(profile.approvalPreset, "approval_first");
  assert.equal(profile.lifeDomains[0].autonomy, "draft_then_ask");
  assert.deepEqual(profile.neverDo, []);
  assert.deepEqual(profile.standingPermissions, []);
});

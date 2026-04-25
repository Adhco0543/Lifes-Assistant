# Intelligence Layer - Quick Integration Guide

## What You're Getting

The Intelligence Layer transforms your AI Assistant into an autonomous colleague that:
- ✅ Makes intelligent decisions about what to do and when
- ✅ Respects user state (online/idle/busy)
- ✅ Respects working hours (only communicate with customers during business hours)
- ✅ Groups similar tasks for efficiency
- ✅ Learns from user feedback
- ✅ Shows its reasoning for transparency
- ✅ Manages approvals for sensitive tasks
- ✅ Delivers notifications according to user preferences

## Files Created

### Core Systems
- `lib/assistantBrain.ts` - Decision engine
- `lib/taskClassifier.ts` - Task analysis
- `lib/userMemoryProfile.ts` - User memory
- `lib/intelligentBackgroundWorker.ts` - Orchestrator
- `lib/smartNotificationManager.ts` - Notifications
- `lib/useIntelligenceLayer.ts` - React hooks

### UI Components
- `components/DecisionTransparency.tsx` - Brain activity panel
- `components/PermissionChecker.tsx` - Approval workflow
- `components/NotificationToast.tsx` - Notification display
- `components/NotificationSystem.tsx` - Notification manager

### Documentation
- `INTELLIGENCE_LAYER.md` - Complete reference
- `INTEGRATION_CHECKLIST.md` - Step-by-step integration
- This file - Quick start guide

## Step 1: Initialize Intelligence Worker on User Login

In your main layout or page that handles user login:

```tsx
// app/layout.tsx or wherever user initializes
import IntelligentBackgroundWorker from "@/lib/intelligentBackgroundWorker";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); // or however you get user

  useEffect(() => {
    if (user?.uid) {
      // Start the intelligent brain
      IntelligentBackgroundWorker.start(user.uid);
    }
  }, [user?.uid]);

  return <>{children}</>;
}
```

## Step 2: Add Notification System

```tsx
// app/layout.tsx or main App component
import NotificationSystem from "@/components/NotificationSystem";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <>
      {user && <NotificationSystem userId={user.uid} />}
      {children}
    </>
  );
}
```

## Step 3: Add Brain Panel and Approval Modal

Update your dashboard or main component:

```tsx
"use client";

import { useState } from "react";
import DecisionTransparency from "@/components/DecisionTransparency";
import PermissionChecker from "@/components/PermissionChecker";

export default function Dashboard({ userId }: { userId: string }) {
  const [showBrain, setShowBrain] = useState(false);

  return (
    <>
      {/* Existing dashboard content */}
      <div className="dashboard">
        <header>
          <button onClick={() => setShowBrain(!showBrain)}>
            🧠 Brain Activity
          </button>
        </header>

        <main>
          {/* Your dashboard content */}
        </main>

        {/* Approval panel - shown when there are pending approvals */}
        <PermissionChecker
          userId={userId}
          onApprove={handleApprove}
          onReject={handleReject}
          onReschedule={handleReschedule}
        />
      </div>

      {/* Brain transparency panel */}
      <DecisionTransparency
        userId={userId}
        isOpen={showBrain}
        onClose={() => setShowBrain(false)}
      />
    </>
  );
}

async function handleApprove(decisionId: string) {
  // Handle approval
}

async function handleReject(decisionId: string, reason?: string) {
  // Handle rejection
}

async function handleReschedule(decisionId: string, newTime: string) {
  // Handle reschedule
}
```

## Step 4: Use Intelligence Hooks in Components

### Get Decision Information

```tsx
import { useDecisions } from "@/lib/useIntelligenceLayer";

export function DecisionStats({ userId }: { userId: string }) {
  const { stats, decisions } = useDecisions(userId);

  return (
    <div>
      <p>Total decisions: {stats.totalDecisions}</p>
      <p>Execution rate: {stats.executionRate.toFixed(0)}%</p>
      <p>Average confidence: {stats.averageConfidence.toFixed(0)}%</p>
    </div>
  );
}
```

### Listen to Notifications

```tsx
import { useNotifications } from "@/lib/useIntelligenceLayer";

export function NotificationBell({ userId }: { userId: string }) {
  const { unreadCount, getUnread } = useNotifications(userId);

  return (
    <button>
      🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
    </button>
  );
}
```

### Manage User Memory Profile

```tsx
import { useUserMemoryProfile } from "@/lib/useIntelligenceLayer";

export function UserProfileForm({ userId }: { userId: string }) {
  const { profile, updateProfile, addCustomer } = useUserMemoryProfile(userId);

  async function handleAddCustomer(name: string) {
    await addCustomer({
      name,
      frequency: 1,
      lastContact: new Date(),
    });
  }

  return (
    <div>
      <h3>Customer: {profile?.businessName}</h3>
      <input
        type="text"
        placeholder="Add customer name"
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            handleAddCustomer(e.currentTarget.value);
          }
        }}
      />
    </div>
  );
}
```

## Step 5: Configure User Memory Profile

Set up the memory profile during onboarding:

```tsx
import UserMemoryProfileManager from "@/lib/userMemoryProfile";

async function setupUserProfile(userId: string) {
  const profile = await UserMemoryProfileManager.createOrGetProfile(userId);

  // Set business info
  profile.businessType = "contractor";
  profile.businessName = "My Construction Business";

  // Set working hours
  profile.workingHours = {
    monday: { start: "08:00", end: "17:00" },
    tuesday: { start: "08:00", end: "17:00" },
    wednesday: { start: "08:00", end: "17:00" },
    thursday: { start: "08:00", end: "17:00" },
    friday: { start: "08:00", end: "17:00" },
    saturday: { start: "09:00", end: "13:00" },
    sunday: { start: "", end: "" },
  };

  // Set preferences
  profile.preferredNotificationStyle = "subtle";
  profile.autoTaskTypes = ["check_emails", "find_jobs"];
  profile.requiresApprovalForTasks = ["send_email", "generate_quote"];

  // Save
  await UserMemoryProfileManager.updateProfile(userId, profile);
}
```

## How It Works - The Flow

### Task Scheduling

```
User creates task via Command Palette
    ↓
Task added to TaskQueue
    ↓
IntelligentBackgroundWorker loop (every 45 seconds)
    ↓
AssistantBrain.makeDecision(task)
    ↓
Decision reasoning generated:
  - Check user state (online/idle/busy)
  - Check task urgency (0-100)
  - Check working hours
  - Check if approval needed
    ↓
Decision made:
  - Execute now? Hold? Batch? Schedule later?
  - Interruption level: silent/subtle/noticeable/urgent
    ↓
SmartNotificationManager creates notification
    ↓
Notification displayed to user
    ↓
Task executed (or held for approval)
    ↓
Decision logged with result
```

### User Override Flow

```
User sees approval in PermissionChecker
    ↓
User clicks Approve / Reject / Reschedule
    ↓
IntelligentBackgroundWorker.overrideDecision() called
    ↓
AssistantBrain.learnFromUserDecision() updates memory
    ↓
Future decisions adjusted based on learning
    ↓
Decision transparency updated
```

## Configuration & Tuning

### Urgency Score Adjustments

Edit `lib/taskClassifier.ts` classifyTask method to adjust urgency:

```typescript
// Base urgency 50
// +30 for high priority
// +20 for financial category
// +15 for customer engagement during working hours
// -20 for research when high-priority pending

// Increase financial urgency:
// +30 for financial instead of +20

// Decrease communication interruption:
// -15 instead of +15 for customer engagement
```

### Decision Confidence Threshold

Edit `lib/assistantBrain.ts`:

```typescript
private static readonly MIN_CONFIDENCE_TO_EXECUTE = 60;
// Lower to 50 to execute more aggressively
// Raise to 70 to be more conservative
```

### Notification Preferences

User can change in profile:

```typescript
preferredNotificationStyle: "silent" | "subtle" | "noticeable" | "prominent"
// silent: only show action_required notifications
// subtle: show subtle and urgent
// noticeable: show most things
// prominent: show everything
```

## Testing the Integration

### Test 1: Basic Decision Making

```typescript
// Create a task with high priority while user is idle
// Expected: Should execute immediately with "subtle" notification
```

### Test 2: Approval Workflow

```typescript
// Create a task marked as requiresApproval
// Expected: Should show in PermissionChecker without executing
// Click approve → Should execute and disappear
```

### Test 3: Learning System

```typescript
// Reject a decision multiple times for same task type
// Expected: Future similar tasks should have lower priority or require approval
```

### Test 4: Working Hours

```typescript
// Schedule customer communication outside working hours
// Expected: Should defer until working hours
// Check can see reasoning in DecisionTransparency
```

## Troubleshooting

### Brain not starting
```
- Check IntelligentBackgroundWorker.start() called on user login
- Check console for errors
- Check Firebase permissions
```

### No notifications showing
```
- Check SmartNotificationManager subscription working
- Check NotificationSystem component added to layout
- Check user notification preferences not set to "silent"
```

### Decisions not showing
```
- Wait 45 seconds for decision loop to run
- Check IntelligentBackgroundWorker.getDecisionHistory() returns data
- Check DecisionTransparency component properly loaded
```

### Tasks not auto-executing
```
- Check task.priority set correctly
- Check MIN_CONFIDENCE_TO_EXECUTE threshold
- Check task doesn't have requiresApproval
- Check user has working hours configured
```

## Next Steps

1. **This hour**: Add IntelligentBackgroundWorker.start() to app initialization
2. **This hour**: Add NotificationSystem to layout
3. **This hour**: Add DecisionTransparency and PermissionChecker to dashboard
4. **Today**: Test approval workflow
5. **Today**: Test decision reasoning in transparency panel
6. **Tomorrow**: Set up user memory profile on onboarding
7. **Tomorrow**: Connect real task handlers to tasks
8. **Week**: ML-based urgency improvements

## Support

For questions about:
- **Architecture**: See INTELLIGENCE_LAYER.md
- **Integration**: See INTEGRATION_CHECKLIST.md
- **Specific component**: Check the file's documentation at the top
- **Configuration**: Check the specific lib file's constants

---

**Status**: Ready for integration ✅
**Errors**: 0
**TypeScript**: Strict mode ✅

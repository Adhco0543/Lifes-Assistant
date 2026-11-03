# 🚀 INTEGRATION GUIDE - Connect All Features

This guide walks you through integrating the 9 new enterprise features into your Dashboard and main app flow.

---

## Phase 1: Core Infrastructure Setup

### 1.1 Environment Variables
- [ ] Add to `.env.local`:
```env
OPENAI_API_KEY=sk-your-key-here
ZIPRECRUITER_API_KEY=optional
LINKEDIN_API_KEY=optional
```

### 1.2 Database Collections
Firestore will auto-create these collections when first written:
- [ ] `users/{userId}/opportunities` - Lead generation results
- [ ] `users/{userId}/searchHistory` - Background search logs
- [ ] `users/{userId}/scheduledTasks` - Scheduled task definitions
- [ ] `users/{userId}/metricEvents` - ROI tracking events
- [ ] `workspaces` - Team workspace definitions
- [ ] `workspaces/{workspaceId}/sharedTasks` - Team task queue
- [ ] `workspaces/{workspaceId}/activityLog` - Team audit trail

### 1.3 Test Voice Pipeline
- [ ] Test `/api/transcribe` endpoint with sample audio
- [ ] Verify OpenAI API key works
- [ ] Check transcription confidence scoring

---

## Phase 2: Dashboard Integration

### 2.1 Add Lead Generation Card
**File:** `components/Dashboard.tsx`

Add import:
```tsx
import { backgroundJobSearch } from "@/lib/backgroundJobSearch";
```

Add card to dashboard (after EmailPanel):
```tsx
<div className="dashboard-section">
  <h2>🎯 Live Leads</h2>
  <LeadsDigestCard userId={userId} />
</div>
```

### 2.2 Add Scheduled Tasks Widget
Add import:
```tsx
import { autonomousTaskScheduler } from "@/lib/autonomousTaskScheduler";
```

Add to dashboard:
```tsx
<div className="dashboard-section">
  <h2>⏰ Scheduled Tasks</h2>
  <ScheduledTasksWidget userId={userId} />
</div>
```

### 2.3 Add ROI Dashboard
Add import:
```tsx
import { ROIAnalyticsDashboard } from "@/components/ROIAnalyticsDashboard";
```

Add prominent section:
```tsx
<div className="dashboard-section featured">
  <ROIAnalyticsDashboard userId={userId} />
</div>
```

### 2.4 Add Workflow Builder
**File:** `app/dashboard/page.tsx` or tab system

```tsx
import { WorkflowBuilder } from "@/components/WorkflowBuilder";

// Add tab or modal trigger
<button onClick={() => setShowWorkflowBuilder(true)}>
  Create Workflow
</button>

{showWorkflowBuilder && (
  <WorkflowBuilder 
    userId={userId}
    onSave={handleWorkflowSave}
    onCancel={() => setShowWorkflowBuilder(false)}
  />
)}
```

---

## Phase 3: Background Services Initialization

### 3.1 Start Lead Search on Login
**File:** `components/Dashboard.tsx` in `useEffect`

```tsx
useEffect(() => {
  // Start background lead search
  backgroundJobSearch.startBackgroundSearch(userId, 60); // Every hour
  
  return () => {
    backgroundJobSearch.stopBackgroundSearch(userId);
  };
}, [userId]);
```

### 3.2 Initialize Task Scheduler
**File:** Same `useEffect`

```tsx
useEffect(() => {
  // Load and resume any scheduled tasks
  autonomousTaskScheduler.getUserScheduledTasks(userId).then(tasks => {
    for (const task of tasks) {
      if (task.isActive) {
        // System automatically resumes monitoring
        console.log(`Resumed task: ${task.description}`);
      }
    }
  });
}, [userId]);
```

---

## Phase 4: User Onboarding Flow

### 4.1 Lead Generation Preferences
**File:** `components/OnboardingForm.tsx`

Add section:
```tsx
<div className="onboarding-section">
  <h3>Background Lead Generation</h3>
  <label>
    <input 
      type="checkbox" 
      defaultChecked={true}
    />
    Find leads automatically (runs every hour)
  </label>
  
  <label>
    Minimum lead quality:
    <select>
      <option value="hot">Hot only (high match)</option>
      <option value="warm">Warm & Hot</option>
      <option value="cold">All leads</option>
    </select>
  </label>
</div>
```

### 4.2 Task Scheduling Preferences
Add section:
```tsx
<div className="onboarding-section">
  <h3>Task Automation</h3>
  <label>
    Enable automated task execution
    <input type="checkbox" defaultChecked={true} />
  </label>
  
  <label>
    Execution mode:
    <select>
      <option value="autonomous">Full autonomous</option>
      <option value="supervised">Ask for approval</option>
      <option value="manual">Manual only</option>
    </select>
  </label>
</div>
```

### 4.3 ROI Tracking Setup
Add section:
```tsx
<div className="onboarding-section">
  <h3>Business Metrics</h3>
  <label>
    Your hourly rate (for ROI calculations):
    <input type="number" placeholder="$150" />
  </label>
</div>
```

---

## Phase 5: Action Tracking Integration

### 5.1 Track Task Completion
When tasks complete, record metrics:

**File:** `lib/workflowExecutor.ts` - Add at execution end:

```typescript
// Track metrics
if (result.success) {
  await roiAnalytics.recordTaskCompleted(
    userId,
    task.taskType,
    30, // estimated minutes saved
    task.description
  );
}
```

### 5.2 Track Email Sent
**File:** `lib/emailService.ts` - After sending email:

```typescript
import { roiAnalytics } from "./roiAnalytics";

// After successful send:
await roiAnalytics.recordEmailSent(userId, recipientEmail, isFollowUp);
```

### 5.3 Track Lead Found
**File:** `lib/backgroundJobSearch.ts` - When storing opportunities:

```typescript
// Before storing opportunities
for (const opp of scoredOpportunities) {
  if (opp.recommendation === "hot") {
    await roiAnalytics.recordLeadFound(
      userId,
      opp.company,
      "hot"
    );
  }
}
```

---

## Phase 6: Team Features Setup

### 6.1 Add Workspace Creator
**File:** New component `components/WorkspaceCreator.tsx`

```tsx
"use client";

import React, { useState } from "react";
import { teamWorkspaceManager } from "@/lib/teamWorkspaceManager";

export function WorkspaceCreator({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    const ws = await teamWorkspaceManager.createWorkspace(
      userId,
      name,
      description
    );
    alert(`Workspace created: ${ws.workspaceId}`);
  };

  return (
    <div>
      <input
        placeholder="Workspace name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <button onClick={handleCreate}>Create Workspace</button>
    </div>
  );
}
```

---

## Phase 7: Testing Checklist

### 7.1 Voice Pipeline Test
- [ ] Open app, click record
- [ ] Speak: "I need a brief on AI ethics"
- [ ] Verify transcription appears
- [ ] Verify confidence score
- [ ] Verify task created and executed

### 7.2 Lead Generation Test
- [ ] Manually trigger background search
- [ ] Verify leads appear in database
- [ ] Verify scoring works (0-100)
- [ ] Verify "hot" leads identified correctly
- [ ] Test marking lead as "emailed"

### 7.3 Task Scheduling Test
- [ ] Create daily recurring task
- [ ] Set time to 1 minute from now
- [ ] Wait for execution
- [ ] Verify execution record created
- [ ] Verify metrics recorded

### 7.4 Team Workspace Test
- [ ] Create workspace
- [ ] Add team member with executor role
- [ ] Create shared task
- [ ] Verify activity log records action
- [ ] Check permission enforcement

### 7.5 ROI Dashboard Test
- [ ] Record test metrics
- [ ] Open analytics dashboard
- [ ] Verify metrics display
- [ ] Test period selector (day/week/month)
- [ ] Verify calculations accurate

---

## Phase 8: Deployment Preparation

### 8.1 Security Rules Update
**Firestore Security Rules:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/** {
      allow read, write: if request.auth.uid == userId;
    }
    match /workspaces/{workspaceId}/** {
      allow read, write: if request.auth.uid in get(/databases/$(database)/documents/workspaces/$(workspaceId)).data.members[*].userId;
    }
  }
}
```

### 8.2 Environment Configuration
- [ ] Set `OPENAI_API_KEY` in Vercel
- [ ] Set lead search interval (recommended: 60 minutes)
- [ ] Set task retry policy (recommended: 3 retries, exponential backoff)
- [ ] Set ROI hourly rate for calculations
- [ ] Enable activity logging for audit trail

### 8.3 Monitoring Setup
- [ ] Set up error tracking (Sentry)
- [ ] Monitor background job health
- [ ] Alert on task failures
- [ ] Track transcription success rate
- [ ] Monitor API usage

---

## Success Metrics

Track these to verify features working:
- [ ] Background searches running every interval
- [ ] Lead scoring generating hot/warm/cold classifications
- [ ] Tasks scheduling and executing autonomously
- [ ] Team workspaces created and active
- [ ] ROI metrics recording accurately
- [ ] Workflow executions successful
- [ ] Zero critical errors in logs

---

## Troubleshooting

### Voice Transcription Not Working
- [ ] Check `OPENAI_API_KEY` is set
- [ ] Verify audio file is being uploaded
- [ ] Check API quota not exceeded
- [ ] Test endpoint directly: `POST /api/transcribe`

### Background Search Not Finding Leads
- [ ] Verify Firestore collections created
- [ ] Check search criteria in profile
- [ ] Manually test `jobBoardConnector.searchAll()`
- [ ] Review opportunity scoring logic

### Tasks Not Executing
- [ ] Check `autonomousTaskScheduler.getRunningSearches()`
- [ ] Verify next run time calculated correctly
- [ ] Check error logs for execution failures
- [ ] Verify workflow steps valid

---

**Last Updated:** April 18, 2026  
**Status:** Ready for Integration  
**Estimated Integration Time:** 4-6 hours

# Immediate Next Builds - Tactical Checklist

## TL;DR

You're 75% to v1. Here's exactly what to build next, in order.

```
Week 1: Home Screen Polish (Easy, High Impact)
Week 2-3: Email Integration (Medium, Very High Value)
Week 4: Voice Input (Medium, Huge Time Saver)
Week 5+: Lead Finding (Optional, Nice to Have)
```

---

## SPRINT 1: HOME SCREEN POLISH (Week 1)

### Goal
Make dashboard answer: "What should I do right now?"

### Components to Build

#### 1. PendingTasksPanel
```typescript
// components/PendingTasksPanel.tsx
interface PendingTask {
  id: string;
  title: string;
  type: "approval" | "awaiting_decision" | "ready_to_execute";
  priority: "high" | "medium" | "low";
  createdAt: Date;
  deadline?: Date;
}

<PendingTasksPanel userId={userId} />
// Shows: "3 items waiting for your decision"
// - Approve quote for John Doe
// - Review follow-up email draft
// - Confirm job search results
```

**Data source**: 
- Firestore: `tasks/{userId}` where status != "completed"
- Filter: `requiresApproval: true OR status: "draft"`

**Files**: 1 component (~200 lines)
**Time**: 4 hours

---

#### 2. UnreadItemsPanel
```typescript
// components/UnreadItemsPanel.tsx
interface UnreadItem {
  id: string;
  type: "notification" | "message" | "execution_result";
  title: string;
  preview: string;
  icon: string;
  timestamp: Date;
}

<UnreadItemsPanel userId={userId} />
// Shows: "2 unread"
// - Quote sent to customer (✓ success)
// - New message: "Hi, did you get my estimate?"
```

**Data source**:
- Firestore: `notifications/{userId}` where `read: false`
- Firestore: `executions/{userId}` where `notified: false`

**Files**: 1 component (~200 lines)
**Time**: 4 hours

---

#### 3. WhileYouWereAwayPanel
```typescript
// components/WhileYouWereAwayPanel.tsx
interface AwayEvent {
  timestamp: Date;
  type: "task_completed" | "decision_made" | "approval_pending";
  title: string;
  details: string;
}

<WhileYouWereAwayPanel userId={userId} />
// Shows: "Since 8 AM"
// - ✓ Sent quote to Smith (high confidence)
// - ✓ Added reminder for tomorrow
// - ⏳ Drafted follow-up email (waiting approval)
```

**Data source**:
- Read: `decisionLogs` from last login to now
- Read: `executionLogs` from last login to now
- Read: `pendingApprovals` from last login to now

**Files**: 1 component (~250 lines)
**Time**: 5 hours

---

#### 4. AssistantStatusCard
```typescript
// components/AssistantStatusCard.tsx
interface Status {
  state: "active" | "idle" | "background_mode" | "offline";
  isOnline: boolean;
  lastDecisionAt: Date;
  nextCheckIn: Date;
  tasksQueued: number;
  approvalsNeeded: number;
}

<AssistantStatusCard userId={userId} />
// Shows:
// 🟢 Active - Background mode ON
// Next decision check: in 45 seconds
// 3 tasks queued, 1 approval needed
```

**Data source**:
- Real-time: Check if IntelligentBackgroundWorker running
- Firestore: `stats/{userId}/status`
- Calculate: (now - lastDecision) to show health

**Files**: 1 component (~150 lines)
**Time**: 3 hours

---

#### 5. QuickActionsBar
```typescript
// components/QuickActionsBar.tsx
<QuickActionsBar userId={userId} />
// Shows buttons:
// [📧 Draft Email] [📝 New Quote] [📋 Materials] [⏰ Set Reminder]
// Also shows pending actions if any
```

**Files**: 1 component (~100 lines)
**Time**: 2 hours

---

### Update Dashboard Layout

```typescript
// Update components/Dashboard.tsx
<div className="dashboard-grid">
  <div className="top-section">
    <AssistantStatusCard />
    <QuickActionsBar />
  </div>
  
  <div className="content-section">
    <PendingTasksPanel />
    <UnreadItemsPanel />
    <WhileYouWereAwayPanel />
  </div>
  
  <div className="intelligence-section">
    <DecisionTransparency />
    <PermissionChecker />
    <ToolExecutionTracker />
  </div>
</div>
```

### Sprint 1 Total
- **Files**: 5 new components
- **Time**: ~18 hours (2 days focused work)
- **Impact**: Dashboard now shows "what needs my attention"

---

## SPRINT 2: EMAIL INTEGRATION (Weeks 2-3)

### Goal
Make EmailTool actually connect to Gmail/Outlook

### Services to Build

#### 1. EmailServiceIntegration
```typescript
// lib/emailService.ts
export class EmailService {
  // Gmail API
  async authenticateGmail(userId: string);
  async readEmails(userId: string, folder: string);
  async sendEmail(userId: string, to, subject, body);
  async draftEmail(userId: string, to, subject, body);
  
  // Outlook API (fallback)
  async authenticateOutlook(userId: string);
  async readEmails_Outlook(userId: string, folder: string);
  async sendEmail_Outlook(userId: string, to, subject, body);
  
  // Classification
  async classifyEmail(email: Email): Promise<"customer" | "invoice" | "followup" | "spam">;
  async suggestReply(email: Email): Promise<string>;
  
  // Storage
  async storeEmailMetadata(userId: string, email: Email);
}
```

**Time**: 2 days
**Setup needed**:
- Gmail API credentials
- OAuth2 flow
- Store refresh token in Firestore

---

#### 2. EmailDraftWorkflow
```typescript
// components/EmailDraftWorkflow.tsx
<EmailDraftWorkflow
  userId={userId}
  to={email.from}
  subject={email.subject}
  suggestedBody={suggestedReply}
  onSend={(draft) => handleSendWithApproval()}
  onDraft={(draft) => saveDraft()}
/>
```

**Features**:
- Show incoming email
- Show AI-suggested reply
- Let user edit
- Option to: send, save draft, or discard

**Time**: 1 day

---

#### 3. InboxSync
```typescript
// lib/inboxSync.ts
// Runs every 30 minutes
export class InboxSync {
  async syncInbox(userId: string) {
    const emails = await EmailService.readEmails(userId, "inbox");
    
    for (const email of emails) {
      // Classify
      const category = await EmailService.classifyEmail(email);
      
      // Create task
      await createTask(userId, {
        type: "email_response",
        category,
        email,
        priority: this.calculatePriority(email)
      });
      
      // Suggest reply
      const suggestion = await EmailService.suggestReply(email);
      
      // Store
      await storeEmailMetadata(userId, email);
    }
  }
}
```

**Time**: 1 day

---

### Email Integration Components

#### EmailPanel (in Dashboard)
```typescript
// components/EmailPanel.tsx
<EmailPanel userId={userId} />
// Shows:
// Inbox: 3 unread
// - John Doe: "Quote ready?" (awaiting reply)
// - City Services: "Invoice attached" (automated)
// - Customer: "Can you start Monday?" (needs draft)
//
// Buttons: Reply, Draft, Forward, Archive
```

**Time**: 4 hours

#### ReplyDraftModal
```typescript
// components/ReplyDraftModal.tsx
<ReplyDraftModal
  email={selectedEmail}
  suggestedReply={aiSuggestion}
  onSend={sendWithApproval}
  onDraft={saveDraft}
/>
```

**Time**: 6 hours

### Integration Points

```typescript
// Update ToolExecutor
if (toolName === "email" && action === "send") {
  // Use EmailService instead of placeholder
  return await EmailService.sendEmail(...);
}

// Update background worker
// Add inboxSync to decision loop
const newEmails = await InboxSync.syncInbox(userId);
for (const email of newEmails) {
  const task = await createEmailResponseTask(email);
  // Let decision engine handle it
}
```

### Sprint 2 Total
- **Services**: 1 new service file (~400 lines)
- **Components**: 3 new components (~400 lines)
- **Time**: ~2 weeks
- **APIs to setup**: Gmail OAuth2
- **Impact**: Can read and draft emails

---

## SPRINT 3: VOICE INPUT (Week 4)

### Goal
Record customer conversations, extract job details automatically

### Components to Build

#### 1. VoiceRecorder
```typescript
// components/VoiceRecorder.tsx
<VoiceRecorder
  onTranscription={(text) => handleTranscript(text)}
  onJobDetected={(jobData) => handleJobExtraction(jobData)}
  maxDuration={3600} // 1 hour
/>
// Shows:
// [🎙 START RECORDING] 
// Timer: 3:45
// [⏹ STOP] [📝 SAVE]
```

**Features**:
- Use Web Audio API
- Real-time transcription (Whisper or Google Speech-to-Text)
- Shows waveform
- Save transcript to Firestore

**Time**: 1 day

---

#### 2. JobExtractor Service
```typescript
// lib/jobExtractor.ts
export class JobExtractor {
  async extractFromTranscript(transcript: string): Promise<JobData> {
    // Use AI to extract:
    const jobData = {
      type: string;           // "deck replacement", "kitchen remodel"
      location: string;       // Address or description
      dimensions: {           // Measurements if mentioned
        width?: string;
        length?: string;
        height?: string;
      };
      materials: string[];    // What materials are needed
      scope: string;          // Full description
      timeline: {
        startDate?: Date;
        deadline?: Date;
        urgency: "asap" | "flexible" | "specific_date";
      };
      budget?: {
        min: number;
        max: number;
      };
      concerns: string[];     // "weathertight", "quick turnaround"
      nextSteps: string[];    // "Send estimate", "Schedule walkthrough"
    };
    
    return jobData;
  }
}
```

**Time**: 2 days (complex extraction logic)

---

#### 3. AutoFilledJobForm
```typescript
// components/AutoFilledJobForm.tsx
<AutoFilledJobForm
  extractedData={jobData}
  onConfirm={(finalData) => createJob(finalData)}
  onEdit={(field, value) => updateField(field, value)}
/>
// Shows extracted data with ability to:
// - Confirm each field
// - Correct mistakes
// - Add missing info
// - See confidence scores
```

**Time**: 1 day

---

#### 4. TranscriptViewer
```typescript
// components/TranscriptViewer.tsx
<TranscriptViewer
  transcript={transcript}
  extractedData={jobData}
  onSaveTranscript={() => saveToFirestore()}
/>
// Shows:
// Raw transcript with timestamps
// Highlighted job details
// Extracted data on right side
```

**Time**: 4 hours

---

### Voice Flow

```
User clicks "Record"
↓
VoiceRecorder starts
↓
User has customer conversation
↓
User clicks "Stop"
↓
Transcription sent to API
↓
JobExtractor.extractFromTranscript()
↓
AutoFilledJobForm shows extracted data
↓
User confirms or corrects
↓
Create job + quote + materials automatically
↓
Task created for follow-up
```

### Sprint 3 Total
- **Services**: 1 new service file (~250 lines)
- **Components**: 3 new components (~500 lines)
- **APIs**: Whisper or Google Speech-to-Text
- **Time**: ~1 week
- **Impact**: Can capture jobs via conversation

---

## SPRINT 4: PROACTIVE LEAD FINDING (Week 5+)

### Goal
Assistant finds jobs automatically when you're not using app

### Services to Build

#### 1. JobBoardConnector
```typescript
// lib/jobBoardConnector.ts
export class JobBoardConnector {
  async searchIndeed(userId: string, criteria: SearchCriteria);
  async searchZipRecruiter(userId: string, criteria: SearchCriteria);
  async searchCustom(userId: string, rssFeeds: string[]);
  
  async findRelevantJobs(userId: string): Promise<Job[]> {
    // Based on user's trade, location, budget preferences
    const profile = await UserMemoryProfile.getProfile(userId);
    
    const jobs = await Promise.all([
      this.searchIndeed(userId, {
        trade: profile.businessType,
        location: profile.workingLocation,
        budget: profile.preferredJobBudget
      }),
      this.searchZipRecruiter(userId, {...}),
      this.searchCustom(userId, profile.customJobFeeds)
    ]);
    
    return jobs.flat();
  }
}
```

**Time**: 3 days

---

#### 2. OpportunityScorer
```typescript
// lib/opportunityScorer.ts
export class OpportunityScorer {
  score(job: Job, userProfile: UserMemoryProfile): Score {
    const factors = {
      tradeMatch: 0-100,           // How well it matches their trade
      budgetFit: 0-100,            // Is it in their preferred range?
      location: 0-100,             // Within service area?
      complexity: 0-100,           // Matches their skill level?
      timeline: 0-100,             // Can they complete it in time?
      historicalSuccess: 0-100     // Similar jobs they succeeded at?
    };
    
    const totalScore = weighted_average(factors);
    return {
      score: totalScore,
      reasons: [list of factors in order],
      recommendation: totalScore > 75 ? "APPLY" : "REVIEW" : "SKIP"
    };
  }
}
```

**Time**: 2 days

---

#### 3. BackgroundJobSearch
```typescript
// lib/backgroundJobSearch.ts - Runs in intelligentBackgroundWorker
export async function runBackgroundJobSearch(userId: string) {
  // Only run if:
  // - User has enabled job search automation
  // - User is not currently active (idle > 30 min)
  // - Last search was > 4 hours ago
  
  const jobs = await JobBoardConnector.findRelevantJobs(userId);
  
  for (const job of jobs) {
    const score = OpportunityScorer.score(job, profile);
    
    if (score.score > 75) {
      // High quality match - notify immediately
      await SmartNotificationManager.createNotification(userId, {
        type: "opportunity_found",
        interruptionLevel: "noticeable",
        title: `Found: ${job.title}`,
        body: `$${job.budget}, ${score.reasons.join(", ")}`,
        action: "view_and_apply"
      });
    } else if (score.score > 50) {
      // Medium match - add to digest
      await addToJobDigest(userId, job, score);
    }
  }
}
```

**Time**: 1 day

---

#### 4. JobDigestNotification
```typescript
// components/JobDigestNotification.tsx
<JobDigestNotification
  userId={userId}
  jobs={digested}
  onApply={(job) => applyToJob(job)}
/>
// Shows:
// "3 jobs found this morning"
// Job 1: Kitchen remodel ($2500) - 88% match
// Job 2: Bathroom tile ($1800) - 72% match
// [View All] [Apply to Best]
```

**Time**: 1 day

---

### Integration Points

```typescript
// Add to IntelligentBackgroundWorker.makeAndExecuteDecisions()
if (user.autoJobSearch && !user.isActive) {
  const jobs = await runBackgroundJobSearch(userId);
  // Notifications created automatically
}

// Add to AutonomySettings
jobSearchBehavior: "auto_search" // enabled
autoSearchFrequency: "daily"       // or "weekly"
autoApplyBudgetLimit: 5000         // auto-apply jobs under $5k
```

### Sprint 4 Total
- **Services**: 3 new service files (~400 lines)
- **Components**: 1 new component (~200 lines)
- **APIs**: Indeed, ZipRecruiter, custom RSS
- **Time**: ~1 week
- **Impact**: Finds jobs while you sleep

---

## THE BUILD SEQUENCE

### Week 1: Home Screen
- Mon: PendingTasksPanel
- Tue: UnreadItemsPanel, WhileYouWereAwayPanel
- Wed: AssistantStatusCard, QuickActionsBar
- Thu-Fri: Integrate into Dashboard

**Status**: Can see "what needs my attention"

---

### Week 2-3: Email Integration
- Mon-Tue: EmailService setup + Gmail OAuth
- Wed: EmailDraftWorkflow
- Thu: InboxSync + EmailPanel
- Fri-Mon: Testing & refinement

**Status**: Can read and draft emails

---

### Week 4: Voice Input
- Mon-Tue: VoiceRecorder + JobExtractor
- Wed: AutoFilledJobForm
- Thu: Integration & testing
- Fri: Refinement

**Status**: Can record jobs via conversation

---

### Week 5+: Lead Finding
- Mon-Tue: JobBoardConnector + OpportunityScorer
- Wed: BackgroundJobSearch
- Thu: JobDigestNotification
- Fri+: Setup APIs

**Status**: Finds jobs automatically

---

## Total Build Summary

| Sprint | Focus | Files | Time | Impact |
|--------|-------|-------|------|--------|
| 1 | Home UX | 5 comp | 2 days | Clarity |
| 2 | Email | 4 files | 2 wks | Utility |
| 3 | Voice | 4 files | 1 wk | Capture |
| 4 | Leads | 4 files | 1 wk | Revenue |
| **Total** | | **17** | **5 wks** | **Complete v1** |

---

## Files Created by This Roadmap

```
components/
├─ PendingTasksPanel.tsx (200)
├─ UnreadItemsPanel.tsx (200)
├─ WhileYouWereAwayPanel.tsx (250)
├─ AssistantStatusCard.tsx (150)
├─ QuickActionsBar.tsx (100)
├─ EmailPanel.tsx (200)
├─ ReplyDraftModal.tsx (250)
├─ VoiceRecorder.tsx (300)
├─ AutoFilledJobForm.tsx (300)
├─ TranscriptViewer.tsx (250)
└─ JobDigestNotification.tsx (200)

lib/
├─ emailService.ts (400)
├─ inboxSync.ts (250)
├─ jobExtractor.ts (250)
├─ jobBoardConnector.ts (300)
├─ opportunityScorer.ts (200)
└─ backgroundJobSearch.ts (150)

Total: 17 files, ~3,500 lines
```

---

## Success Metrics

After each sprint:

**Sprint 1**: Dashboard tells you what to do
- KPI: Users check dashboard first thing

**Sprint 2**: Email saves time
- KPI: Time drafting emails reduced 50%

**Sprint 3**: Voice captures jobs fast
- KPI: Time creating jobs reduced 70%

**Sprint 4**: System finds opportunities
- KPI: Passive lead generation working

---

## What This Achieves

At the end:

✅ **Remembers** - All user data persistent
✅ **Thinks** - Makes smart decisions 24/7
✅ **Acts** - Reads emails, creates quotes, finds jobs
✅ **Explains** - Shows all reasoning
✅ **Asks** - Only when needed
✅ **Learns** - Improves from feedback

**It's a real business assistant.** 🚀

---

Start with Sprint 1 this week. It's fast and will give you immediate clarity on what to work on next.

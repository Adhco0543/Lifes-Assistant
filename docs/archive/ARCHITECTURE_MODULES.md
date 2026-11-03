# Business AI Assistant - 4 Module Architecture

## Overview

The Business AI Assistant is organized into 4 core modules that work together to create a complete autonomous business system.

```
┌─────────────────────────────────────────────────────────────────┐
│                    UX + TRUST LAYER                             │
│  (Dashboard, Approvals, Notifications, Continuity)              │
├─────────────────────────────────────────────────────────────────┤
│                 BUSINESS ACTIONS                                 │
│        (Emails, Quotes, Materials, Leads)                        │
│                    +                                             │
│         TASKS & BACKGROUND EXECUTION                             │
│    (Decision Engine, Task Queue, Background Worker)              │
├─────────────────────────────────────────────────────────────────┤
│           CONVERSATIONS + MEMORY                                 │
│    (AI Chat, User Profile, Persistent Context)                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module 1: Conversations + Memory

**Purpose**: Store and manage all interactions, learning, and persistent user context.

### Components

#### Conversation Management
- **`components/AdvancedConversationalChat.tsx`** - Main chat UI
- **`components/ConversationalChat.tsx`** - Conversation logic
- **`lib/realAI.ts`** - AI conversation engine

#### User Memory & Context
- **`lib/userMemoryProfile.ts`** - Persistent user profile (14 categories)
  - Communication preferences (tone, style)
  - Business info (type, hours, materials)
  - People relationships (customers, contacts)
  - Resources (vendors, materials, tools)
  - Preferences (quote style, autonomy)
  - Learning (pain points, goals)
  - State (priorities, unfinished conversations)

#### Data Storage
- **Firestore**: `users/{userId}/settings/profile` - User memory
- **Firestore**: `conversations/{conversationId}` - Conversation history
- **LocalStorage**: Fallback for profile data

### Key Functions

```typescript
// Load/save user context
const profile = await UserMemoryProfile.getProfile(userId);
await UserMemoryProfile.updateProfile(userId, updates);

// Store conversation
const conversation = {
  userId,
  timestamp,
  messages: [...],
  context: { ... }
};
```

### Data Flow

```
User Message
  ↓
AdvancedConversationalChat receives input
  ↓
realAI.generateResponse(message, context)
  ↓
Read UserMemoryProfile for context
  ↓
Generate response using conversation history
  ↓
Store in Firestore + UserMemoryProfile
  ↓
Display to user
```

### Stored Information

**User Profile** (Firestore):
- Business: name, type, industry, size, revenue model
- Operations: working hours, workMode, team structure
- Relationships: frequent customers, vendors, team
- Preferences: communication style, quote format
- Learning: pain points, goals, preferred tools
- History: past conversations, successful patterns

---

## Module 2: Tasks & Background Execution

**Purpose**: Manage task queues, make autonomous decisions, execute in background.

### Components

#### Task Management
- **`lib/intelligentBackgroundWorker.ts`** - Main orchestrator (45-second decision loop)
- **`lib/assistantBrain.ts`** - Decision engine (scores confidence 0-100)
- **`lib/taskClassifier.ts`** - Categorizes tasks by urgency
- **`lib/TaskQueue.ts`** - Queue for pending tasks (in Firestore)

#### Decision System
- **AssistantBrain** - Analyzes tasks and decides: execute, draft, ask, defer
- **TaskClassifier** - Scores urgency 0-100 based on:
  - Task priority
  - Task category (communication, planning, financial, etc.)
  - Business context
  - Time sensitivity
- **PresenceManager** - Tracks if user is active/offline
- **UserMemoryProfile** - Provides context for decisions

#### Execution Control
- **`lib/toolRegistry.ts`** - Registry of 7 available tools
- **`lib/toolExecutor.ts`** - Executes with approval checking
- **`lib/autonomySettings.ts`** - User permission rules

### Task Flow

```
Task Created (from chat, manual, or system)
  ↓
Stored in Firestore: tasks/{taskId}
  ↓
IntelligentBackgroundWorker.start(userId) runs every 45s
  ↓
Fetch pending tasks from queue
  ↓
TaskClassifier.classifyTask()
  - Scores urgency (0-100)
  - Determines category
  - Checks dependencies
  ↓
AssistantBrain.makeDecision()
  - Evaluates user state (working hours, presence)
  - Checks confidence (task clarity, context)
  - Determines action: execute, draft, ask, defer
  ↓
Two paths:
  
  Path A: Execute (confidence ≥ 60)
    → ToolExecutor.executeTool()
    → Check autonomy settings
    → If approved → Execute
    → If denied → Request approval
    ↓
  Path B: Ask (confidence 30-60)
    → Create notification
    → Show PermissionChecker
    → Wait for user decision
    ↓
  Path C: Defer (confidence < 30 or bad timing)
    → Reschedule for later
    → Better context needed
    ↓
Decision logged for learning
  ↓
Result stored in Firestore
```

### Example Decision Making

**Scenario 1: Send Quote Email**
```
Task: Send quote to john@example.com
ClassifiedTask:
  urgency: 85 (high priority, waiting customer)
  category: financial
  confidence: 92 (quote calculated, customer known)

Decision:
  - User is working (9 AM)
  - Quote is ready
  - Email to known customer
  - AutoSettings: emailBehavior = "auto_send"
  → ACTION: EXECUTE
  → Log: "Auto-sent quote email"
```

**Scenario 2: Draft Follow-up Email**
```
Task: Send follow-up to customer
ClassifiedTask:
  urgency: 45 (medium, generic)
  category: communication
  confidence: 55 (no prior context)

Decision:
  - User is working
  - Generic follow-up (need specifics)
  - AutoSettings: emailBehavior = "draft_only"
  → ACTION: ASK
  → Show: "Auto-drafted follow-up email - review before sending?"
  → Log: "Awaiting approval for follow-up email"
```

**Scenario 3: Search Jobs (Late Night)**
```
Task: Auto-search for new jobs
ClassifiedTask:
  urgency: 30 (low)
  category: research
  confidence: 90 (clear criteria)

Decision:
  - User is offline (midnight)
  - AutoSettings: disableDuringHours = true
  - Disabled from 6 PM - 8 AM
  → ACTION: DEFER
  → Reschedule for 8:30 AM
  → Log: "Deferred job search to working hours"
```

### Constants

- **Decision Loop Interval**: 45 seconds
- **Min Confidence to Auto-Execute**: 60
- **Ask Confidence Range**: 30-60
- **Log Retention**: 7 days
- **Approval Timeout**: 24 hours

---

## Module 3: Business Actions

**Purpose**: Execute specific business tools and integrate with business systems.

### Components

#### Tool System
- **`lib/toolRegistry.ts`** - Registry of 7 tools
- **`lib/toolExecutor.ts`** - Execution with approval
- **`lib/autonomySettings.ts`** - User permission rules

#### The 7 Tools

1. **EmailTool**
   - Actions: send, draft, read, list
   - Autonomy: User can set to ask/draft/auto-send
   - By category: customer, followup, invoice

2. **QuoteTool**
   - Actions: create, calculate, send, template
   - Autonomy: User can set to ask/auto-create/auto-send
   - Threshold: Auto-send quotes under $X

3. **MaterialsTool**
   - Actions: calculate
   - Returns: material list + costs
   - Autonomy: Can auto-execute (non-risky)

4. **JobSearchTool**
   - Actions: search, apply
   - Autonomy: Daily/weekly/on-demand
   - Frequency: Can configure search schedule

5. **ReminderTool**
   - Actions: set, list, complete, snooze
   - Autonomy: Can auto-execute
   - Use: Follow-ups, deadlines

6. **CustomerLookupTool**
   - Actions: lookup by name/id
   - Returns: contact info, history, totals
   - Uses: UserMemoryProfile integration

7. **CalendarTool**
   - Actions: add_event, list, block_time, reschedule
   - Autonomy: Can auto-execute
   - Sync: With business calendar

### Tool Execution Flow

```
Task requires tool execution
  ↓
ToolExecutor.executeTool(userId, toolName, payload)
  ├─ Validate payload
  ├─ Get AutonomySettings
  ├─ Check approval required:
  │  ├─ Tool in requiresApprovalForTasks?
  │  ├─ During disable hours?
  │  ├─ Amount over threshold?
  │  └─ Daily limit exceeded?
  ├─ Execute or hold for approval
  ├─ Log execution
  └─ Return result {success, message, data}
  ↓
If approved → Execute tool
If rejected → Queue for later
If pending → Show PermissionChecker
```

### Autonomy Rules

**Default Auto-Execute** (no approval):
- Job search
- Materials calculation
- Customer lookup
- Reminders

**Default Requires Approval**:
- Email sending
- Quote sending
- Large amounts (> $10,000)

**Disable Hours**:
- Example: 6 PM - 8 AM (evenings/nights)
- Can be customized per user

### Integration Points

**With Chat**: User can say "Send quote to John" → AI creates task → Tool executes
**With Memory**: Pulls customer info from UserMemoryProfile
**With Notifications**: Sends approval requests via SmartNotificationManager
**With Dashboard**: Shows execution history in ToolExecutionTracker

---

## Module 4: UX + Trust Layer

**Purpose**: Show users what's happening, get approval when needed, maintain trust.

### Components

#### Decision Transparency
- **`components/DecisionTransparency.tsx`** - Show assistant's reasoning
  - Real-time decision statistics
  - Decision history with full reasoning
  - Confidence scores
  - Success rate

#### Approval Workflow
- **`components/PermissionChecker.tsx`** - Tasks needing approval
  - Why approval needed
  - One-click approve/reject
  - Reschedule option
- **`components/ToolExecutionTracker.tsx`** - Execution history
  - All tool executions
  - Success/failure status
  - Payload inspection
  - Result details

#### Notifications
- **`lib/smartNotificationManager.ts`** - Notification delivery
- **`components/NotificationSystem.tsx`** - Global notification manager
- **`components/NotificationToast.tsx`** - Individual notifications
  - Interruption levels: silent → subtle → noticeable → urgent
  - Auto-hide timing
  - Clickable actions

#### Autonomy Settings
- **`components/AutonomySettingsForm.tsx`** - Settings UI
  - Preset buttons (conservative, balanced, aggressive, office_hours)
  - Tab-based: Email, Quotes, Jobs, Background, Notifications, Safety
  - Real-time updates
  - Help text

#### Dashboard
- **`components/Dashboard.tsx`** - Main hub
  - Shows 3 intelligence panels:
    - DecisionTransparency (what AI thinks)
    - PermissionChecker (what needs approval)
    - ToolExecutionTracker (what executed)
  - Quick action buttons
  - Metrics and stats

#### Session Continuity
- **`lib/interactions.ts`** - Session state management
- **`components/PageWithTheme.tsx`** - Persistent UI state
- **LocalStorage**: Session continuation

### Trust Flow

```
User does action / Task created
  ↓
Decision made by AssistantBrain (Module 2)
  ↓
Four outcomes:
  
  1. AUTO-EXECUTE (high confidence)
     → Execute silently
     → Log execution
     → Show subtle notification
     → Store in ToolExecutionTracker
     
  2. AUTO-DRAFT (medium confidence)
     → Create draft
     → Show in PermissionChecker
     → Wait for approval
     → User can edit before sending
     
  3. ASK (uncertain)
     → Show PermissionChecker with options
     → Display reasoning
     → User approves/rejects/reschedules
     → Learn from feedback
     
  4. DEFER (bad timing)
     → Reschedule for better time
     → Show in decision history
     → Retry when conditions improve

All visible in:
  - DecisionTransparency: "Here's what I decided and why"
  - ToolExecutionTracker: "Here's what I actually did"
  - PermissionChecker: "Here's what I need from you"
```

### Autonomy Settings

Users control automation with **4 presets**:

**🛑 Conservative** (Maximum safety)
- Ask for approval on everything sensitive
- No background mode
- Best for: Learning users, high-risk operations

**⚖️ Balanced** (Recommended)
- Auto-draft emails/quotes
- Ask before sending
- Auto-search jobs
- Background mode enabled
- Best for: Most users

**🚀 Aggressive** (Maximum speed)
- Auto-send emails and quotes
- Auto-apply to jobs
- Full background operation
- Best for: Trusted automation, power users

**🏢 Office Hours** (Work-life balance)
- Only work 8 AM - 6 PM
- Auto-draft, ask before send
- No background mode
- Best for: Work-life balance

### Notification System

**Interruption Levels**:
- **Silent** (hidden): Background processes, non-urgent
- **Subtle** (toast 5s): Info notifications
- **Noticeable** (modal 8s): Important updates
- **Urgent** (full-screen): Approval requests, errors

**Types**:
- `auto_execute` - Tool executed
- `action_required` - Needs approval
- `contextual_tip` - AI suggestion
- `error` - Something failed
- `success` - Operation completed

---

## Data Flow: Complete Example

### Scenario: Customer Requests Quote

```
Step 1: User receives customer call
┌─────────────────────┐
│ Chat Input          │
│ "John called, needs │
│  quote for deck     │
│  replacement"       │
└─────────────────────┘
         ↓
Step 2: AI understands intent (Module 1)
┌─────────────────────┐
│ AdvancedChat        │
│ → realAI.generate   │
│   (uses user memory)│
└─────────────────────┘
         ↓
Step 3: Create task (Module 2)
┌─────────────────────┐
│ Task created:       │
│ {                   │
│   type: "quote",    │
│   customer: "John", │
│   project: "deck",  │
│   urgency: HIGH     │
│ }                   │
└─────────────────────┘
         ↓
Step 4: Background worker processes (Module 2)
┌─────────────────────┐
│ TaskClassifier:     │
│   urgency: 92       │
│   category: finance │
│ AssistantBrain:     │
│   confidence: 88    │
│   action: EXECUTE   │
└─────────────────────┘
         ↓
Step 5: Execute tool (Module 3)
┌─────────────────────┐
│ ToolExecutor:       │
│ - Get John's info   │
│   (from memory)     │
│ - Calculate quote   │
│   (materials tool)  │
│ - Send quote        │
│   (email tool)      │
└─────────────────────┘
         ↓
Step 6: Show results (Module 4)
┌─────────────────────┐
│ Dashboard shows:    │
│ - Decision: "Auto   │
│   sent quote to     │
│   John" (reasoning) │
│ - Execution: "Email │
│   sent 9:30 AM"     │
│ - Notification:     │
│   "Quote sent ✓"    │
└─────────────────────┘
         ↓
Step 7: Learn from outcome (Module 1+2)
┌─────────────────────┐
│ Update:             │
│ - UserMemory:       │
│   "successfully     │
│   sent deck quotes" │
│ - Decision history: │
│   "high confidence  │
│   quote sending"    │
└─────────────────────┘
```

---

## Module Dependencies

```
Module 1: Conversations + Memory
    ↓
    └→ realAI.ts, userMemoryProfile.ts
    └→ Firestore: conversations, users/{userId}/settings/profile
    
Module 2: Tasks & Background Execution
    ↓
    ├→ Reads: Module 1 (UserMemoryProfile)
    ├→ Uses: assistantBrain.ts, taskClassifier.ts
    ├→ Calls: Module 3 (ToolExecutor)
    ├→ Notifies: Module 4 (SmartNotificationManager)
    └→ Firestore: tasks, decisions, execution_logs
    
Module 3: Business Actions
    ↓
    ├→ Called by: Module 2 (intelligentBackgroundWorker)
    ├→ Uses: ToolRegistry, autonomySettings
    ├→ Reads: Module 1 (UserMemoryProfile for context)
    └→ Firestore: execution_logs, autonomy_settings
    
Module 4: UX + Trust Layer
    ↓
    ├→ Displays: Module 2 (decisions, task history)
    ├→ Displays: Module 3 (execution history)
    ├→ Updates: autonomySettings
    ├→ Shows: Module 1 (conversation history)
    └→ React components: Dashboard, PermissionChecker, etc.
```

---

## File Organization by Module

### Module 1: Conversations + Memory
```
lib/
  ├─ realAI.ts ..................... AI chat engine
  ├─ userMemoryProfile.ts ........... User context & learning
  ├─ interactions.ts ................ Session state
  └─ personalization.ts ............. User preferences

components/
  ├─ AdvancedConversationalChat.tsx .. Main chat UI
  ├─ ConversationalChat.tsx .......... Chat logic
  ├─ DarkModeAware.tsx ............... Theme support
  └─ ThemeProvider.tsx ............... Theme context
```

### Module 2: Tasks & Background Execution
```
lib/
  ├─ intelligentBackgroundWorker.ts . Main orchestrator (45s loop)
  ├─ assistantBrain.ts .............. Decision engine
  ├─ taskClassifier.ts .............. Task urgency scoring
  ├─ businessProfile.ts ............. Business context
  └─ analytics.ts ................... Decision tracking

(No dedicated components - works in background)
```

### Module 3: Business Actions
```
lib/
  ├─ toolRegistry.ts ................ Tool registry (7 tools)
  ├─ toolExecutor.ts ................ Execution + approval
  ├─ autonomySettings.ts ............ Permission rules
  ├─ quotingSystem.ts ............... Quote calculations
  ├─ noteManager.ts ................. Notes/project info
  └─ firebaseBackend.ts ............. Firebase integration

components/
  ├─ QuoteBuilder.tsx ............... Quote UI
  ├─ EmailComposer.tsx .............. Email UI
  ├─ MaterialEstimator.tsx .......... Materials UI
  └─ NoteEditor.tsx ................. Notes UI
```

### Module 4: UX + Trust Layer
```
lib/
  ├─ smartNotificationManager.ts .... Notification logic
  └─ hooks.ts ....................... React hooks

components/
  ├─ Dashboard.tsx .................. Main hub
  ├─ DecisionTransparency.tsx ....... Decision visibility
  ├─ PermissionChecker.tsx .......... Approval requests
  ├─ ToolExecutionTracker.tsx ....... Execution history
  ├─ AutonomySettingsForm.tsx ....... Settings UI
  ├─ NotificationSystem.tsx ......... Global notifications
  ├─ NotificationToast.tsx .......... Notification display
  ├─ PageWithTheme.tsx .............. Page wrapper
  ├─ EnhancedApp.tsx ................ App container
  ├─ App.tsx ........................ Main app logic
  └─ OnboardingForm.tsx ............. Onboarding flow
```

---

## Integration Points

### Module 1 → 2
```typescript
// Background worker reads user profile for decision context
const profile = await UserMemoryProfile.getProfile(userId);
const decision = AssistantBrain.makeDecision(task, profile);
```

### Module 2 → 3
```typescript
// Background worker executes tools
const result = await ToolExecutor.executeTool(userId, toolName, payload);
```

### Module 2 → 4
```typescript
// Background worker notifies UI
SmartNotificationManager.createNotification(userId, decision);
```

### Module 3 → 1
```typescript
// Tool execution updates user memory
await UserMemoryProfile.updateProfile(userId, { 
  commonJobTypes: [...], 
  preferredTools: [...] 
});
```

### Module 4 ↔ All
```typescript
// Dashboard displays all module information
<DecisionTransparency userId={userId} />        {/* Module 2 */}
<PermissionChecker userId={userId} />           {/* Module 2+3 */}
<ToolExecutionTracker userId={userId} />        {/* Module 3 */}
```

---

## State Management

### Firestore Collections
```
users/{userId}/
  ├─ settings/
  │  ├─ profile ..................... Module 1 (user memory)
  │  └─ autonomy .................... Module 3 (permissions)
  ├─ tasks/ ......................... Module 2 (pending tasks)
  ├─ decisions/ ..................... Module 2 (decision logs)
  ├─ executions/ .................... Module 3 (tool execution logs)
  └─ conversations/ ................. Module 1 (chat history)
```

### LocalStorage Fallback
```
onboarding_profile .................. Module 1 (user info)
notifications_{userId} ............. Module 4 (notifications)
session_state ...................... Module 4 (UI state)
```

---

## Initialization Sequence

```
1. User logs in
   └→ Initialize Firebase
   
2. Load business profile (Module 1)
   └→ UserMemoryProfile.getProfile(userId)
   
3. Start background worker (Module 2)
   └→ IntelligentBackgroundWorker.start(userId)
   └→ Decision loop runs every 45s
   
4. Load autonomy settings (Module 3)
   └→ AutonomySettingsManager.getSettings(userId)
   
5. Initialize UI (Module 4)
   └→ Show Dashboard
   └→ Subscribe to notifications
   
6. Show greeting + onboarding if needed
   └→ GreetingSystem, OnboardingForm
```

---

## Success Metrics by Module

### Module 1: Conversations + Memory
- ✅ All conversations stored and retrievable
- ✅ User profile accuracy (decisions improve)
- ✅ Memory retention (7 days to unlimited)
- ✅ Learning rate (system improves over time)

### Module 2: Tasks & Background Execution
- ✅ Decision loop runs consistently
- ✅ Average confidence score > 70
- ✅ User approval rate (metric of accuracy)
- ✅ Task throughput (tasks/hour)

### Module 3: Business Actions
- ✅ All 7 tools executing successfully
- ✅ Autonomy rule compliance
- ✅ Tool execution success rate > 95%
- ✅ Execution history tracked

### Module 4: UX + Trust Layer
- ✅ Users understand decisions
- ✅ Approval requests clear and actionable
- ✅ Notifications respected
- ✅ No false approvals (user trusts system)

---

## Next Steps

### MVP (Minimum Viable Product)
1. ✅ Module 1: Basic chat + memory
2. ✅ Module 2: Decision engine + background worker
3. ✅ Module 3: Tool registry + execution
4. ✅ Module 4: Dashboard + approvals + notifications

### Enhancement Phase
1. **Real API Integration**
   - Connect to real email service
   - Connect to calendar system
   - Connect to job boards
   - Connect to quote/invoicing system

2. **Advanced Learning**
   - ML models for decision confidence
   - Pattern recognition in user behavior
   - Proactive task suggestion
   - Outcome prediction

3. **Team Features**
   - Multi-user collaboration
   - Role-based permissions
   - Team approval workflows
   - Shared decision logs

4. **Analytics & Insights**
   - Usage analytics
   - Decision quality metrics
   - Time savings calculations
   - ROI dashboard

---

## Summary

The 4-module architecture creates a complete autonomous business assistant:

1. **Module 1** - Remembers who users are and what they've told it
2. **Module 2** - Decides what to do automatically
3. **Module 3** - Actually does business actions
4. **Module 4** - Shows users what happened and gets approval when needed

Together they create a system that:
- 🧠 **Thinks** (Module 2)
- 💾 **Remembers** (Module 1)
- 🎯 **Acts** (Module 3)
- 👁️ **Explains** (Module 4)

**Status**: All modules complete and integrated ✅

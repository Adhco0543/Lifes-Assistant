# 📚 API REFERENCE - All Services & Exports

Complete reference for all 9 new features and how to use them.

---

## 🎙️ Voice Transcription API

### Endpoint
```
POST /api/transcribe
```

### Request
```typescript
const formData = new FormData();
formData.append("audio", audioBlob, "audio.webm");

const response = await fetch("/api/transcribe", {
  method: "POST",
  body: formData,
});

const { text, confidence, duration } = await response.json();
```

### Response
```typescript
{
  text: string;           // Transcribed text
  confidence: number;     // 0-100 confidence score
  duration: number;       // Audio duration in seconds
}
```

---

## 🎯 Lead Finding System

### Import
```typescript
import { 
  jobBoardConnector,
  opportunityScorer,
  backgroundJobSearch
} from "@/lib";
```

### jobBoardConnector
**Search job boards**

```typescript
// Search all boards (Indeed, ZipRecruiter, LinkedIn)
const opportunities = await jobBoardConnector.searchAll({
  keywords: ["plumbing", "hvac"],
  location: "Austin, TX",
  radius: 50,
  salaryMin: 80000,
  salaryMax: 500000,
  jobType: "all",
});

// Interface
interface SearchCriteria {
  keywords: string[];
  location: string;
  radius?: number;
  salaryMin?: number;
  salaryMax?: number;
  jobType?: "full-time" | "contract" | "hourly" | "all";
  industry?: string;
}

interface JobOpportunity {
  id: string;
  source: "indeed" | "ziprecruiter" | "linkedin";
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  salary?: { min: number; max: number };
  postedDate: Date;
  requirements: string[];
  contactEmail?: string;
  contactPhone?: string;
}
```

### opportunityScorer
**Score leads against business profile**

```typescript
// Score single opportunity
const scored = opportunityScorer.scoreOpportunity(opportunity, userProfile);

// Score multiple and get recommendations
const scored = opportunityScorer.scoreOpportunities(opportunities, userProfile);

// Filter by recommendation
const hotLeads = opportunityScorer.filterByRecommendation(
  scoredOps,
  "hot" // "hot" | "warm" | "cold" | "skip"
);

// Interface
interface ScoredOpportunity extends JobOpportunity {
  score: number; // 0-100
  reasoning: string;
  scoreBreakdown: {
    titleMatch: number;
    industryMatch: number;
    locationMatch: number;
    salaryMatch: number;
    skillsMatch: number;
    urgency: number;
  };
  recommendation: "hot" | "warm" | "cold" | "skip";
}
```

### backgroundJobSearch
**Autonomous background lead generation**

```typescript
// Start searching every N minutes
backgroundJobSearch.startBackgroundSearch(userId, 60);

// Stop searching
backgroundJobSearch.stopBackgroundSearch(userId);

// Get user's stored opportunities
const leads = await backgroundJobSearch.getUserOpportunities(userId, 50);

// Mark as actioned
await backgroundJobSearch.markOpportunity(userId, leadId, "emailed");

// Get search history
const history = await backgroundJobSearch.getSearchHistory(userId, 30);

// Interfaces
interface StoredOpportunity extends ScoredOpportunity {
  userId: string;
  savedAt: Date;
  actionTaken?: "emailed" | "contacted" | "dismissed" | "archived";
}

interface BackgroundSearchJob {
  id: string;
  userId: string;
  runAt: Date;
  searchCriteria: SearchCriteria;
  opportunitiesFound: number;
  hotOpportunities: number;
  warmOpportunities: number;
  status: "pending" | "running" | "completed" | "failed";
  error?: string;
  resultsStored: boolean;
}
```

---

## ⏰ Task Scheduling

### Import
```typescript
import { autonomousTaskScheduler } from "@/lib";
```

### Methods
```typescript
// Schedule task
const scheduled = await autonomousTaskScheduler.scheduleTask(userId, task, {
  type: "once" | "recurring" | "conditional",
  runsAt?: Date,                    // For 'once'
  interval?: "daily" | "weekly" | "hourly" | "every_2_hours" | "every_4_hours",
  dayOfWeek?: number,               // 0-6 for 'weekly'
  timeOfDay?: "09:00",              // HH:mm format
  condition?: string,               // For 'conditional'
});

// Get scheduled tasks
const tasks = await autonomousTaskScheduler.getUserScheduledTasks(userId);

// Get execution history
const history = await autonomousTaskScheduler.getTaskExecutionHistory(
  userId,
  scheduledTaskId,
  20
);

// Cancel task
await autonomousTaskScheduler.cancelScheduledTask(userId, scheduledTaskId);

// Interfaces
interface ScheduledTask extends CustomTask {
  scheduledTaskId: string;
  schedule: TaskSchedule;
  lastRunAt?: Date;
  nextRunAt: Date;
  isActive: boolean;
  executionHistory: ExecutionRecord[];
  maxRetries: number;
  retryCount: number;
}

interface TaskSchedule {
  type: "once" | "recurring" | "conditional";
  runsAt?: Date;
  interval?: "daily" | "weekly" | "hourly" | "every_2_hours" | "every_4_hours";
  dayOfWeek?: number;
  timeOfDay?: string;
  condition?: string;
}

interface ExecutionRecord {
  executedAt: Date;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
}
```

---

## 👥 Team Workspace

### Import
```typescript
import { teamWorkspaceManager } from "@/lib";
```

### Methods
```typescript
// Create workspace
const workspace = await teamWorkspaceManager.createWorkspace(
  ownerId,
  "Sales Team",
  "Team workspace for sales operations"
);

// Add member
await teamWorkspaceManager.addMember(
  workspaceId,
  userId,
  "user@example.com",
  "executor", // "owner" | "manager" | "executor" | "viewer"
  addedByUserId
);

// Update member role
await teamWorkspaceManager.updateMemberRole(
  workspaceId,
  userId,
  "manager",
  updatedByUserId
);

// Remove member
await teamWorkspaceManager.removeMember(workspaceId, userId, removedByUserId);

// Check permissions
const canExecute = await teamWorkspaceManager.canUserPerformAction(
  workspaceId,
  userId,
  "execute_tasks"
);

// Get workspace
const workspace = await teamWorkspaceManager.getWorkspace(workspaceId);

// Get user's workspaces
const workspaces = await teamWorkspaceManager.getUserWorkspaces(userId);

// Share task
await teamWorkspaceManager.shareTaskWithWorkspace(
  workspaceId,
  taskId,
  title,
  description,
  createdBy,
  assignedTo
);

// Get workspace tasks
const tasks = await teamWorkspaceManager.getWorkspaceTasks(workspaceId);

// Log activity
await teamWorkspaceManager.logActivity(
  workspaceId,
  userId,
  "action_type",
  "target",
  { details: {} }
);

// Get activity log
const log = await teamWorkspaceManager.getActivityLog(workspaceId, 100);

// Interfaces
interface TeamWorkspace {
  workspaceId: string;
  name: string;
  description: string;
  owner: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
  settings: TeamSettings;
}

interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "executor" | "viewer";
  joinedAt: Date;
  isActive: boolean;
}

interface TeamSettings {
  allowPublicSharing: boolean;
  requireApprovalForTasks: boolean;
  taskExecutionMode: "autonomous" | "supervised" | "manual";
  enableActivityLog: boolean;
  enableNotifications: boolean;
  retentionDays: number;
}

interface SharedTask {
  taskId: string;
  workspaceId: string;
  title: string;
  description: string;
  createdBy: string;
  assignedTo?: string;
  status: "draft" | "pending" | "executing" | "completed" | "failed";
  result?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

---

## 📊 ROI Analytics

### Import
```typescript
import { roiAnalytics } from "@/lib";
```

### Methods
```typescript
// Record metrics
await roiAnalytics.recordTaskCompleted(userId, taskType, minutesSaved, description);
await roiAnalytics.recordEmailSent(userId, "recipient@example.com", isFollowUp);
await roiAnalytics.recordDecisionMade(userId, decisionType, "high" | "medium" | "low");
await roiAnalytics.recordLeadFound(userId, "Company Name", "hot" | "warm" | "cold");
await roiAnalytics.recordRevenueGenerated(userId, 5000, "source");

// Get metrics
const metrics = await roiAnalytics.getROIMetrics(
  userId,
  "day" | "week" | "month" | "all"
);

// Get task metrics
const taskMetrics = await roiAnalytics.getTaskMetrics(userId);

// Get trend over time
const trend = await roiAnalytics.getMetricTrend(userId, "task_completed", 30);

// Set hourly rate
roiAnalytics.setHourlyRate(150);

// Interfaces
interface ROIMetrics {
  userId: string;
  period: "day" | "week" | "month" | "all";
  totalTasksCompleted: number;
  totalEmailsSent: number;
  totalDecisionsMade: number;
  totalLeadsFound: number;
  totalTimeSavedMinutes: number;
  estimatedRevenuePerHour: number;
  totalRevenueGenerated: number;
  roi: number;
  metrics: Record<string, number>;
}

interface TaskMetrics {
  taskType: string;
  count: number;
  averageTimeMinutes: number;
  successRate: number;
  failureRate: number;
  averageValuePerTask: number;
}

interface MetricEvent {
  id: string;
  userId: string;
  type: "task_completed" | "email_sent" | "decision_made" | "lead_found" | "time_saved" | "revenue_generated";
  value: number;
  description: string;
  timestamp: Date;
  metadata: Record<string, any>;
}
```

---

## 🎨 UI Components

### WorkflowBuilder
```typescript
import { WorkflowBuilder } from "@/components/WorkflowBuilder";

<WorkflowBuilder 
  userId={userId}
  onSave={(workflow: CustomTask) => {
    // Handle saved workflow
  }}
  onCancel={() => {
    // Handle cancel
  }}
/>
```

**Props:**
```typescript
interface WorkflowBuilderProps {
  userId: string;
  onSave?: (workflow: CustomTask) => void;
  onCancel?: () => void;
}
```

---

### ROIAnalyticsDashboard
```typescript
import { ROIAnalyticsDashboard } from "@/components/ROIAnalyticsDashboard";

<ROIAnalyticsDashboard userId={userId} />
```

**Props:**
```typescript
interface ROIAnalyticsDashboardProps {
  userId: string;
}
```

---

## 🔄 Workflow Execution

### Import
```typescript
import { workflowExecutor } from "@/lib";
```

### Methods
```typescript
// Execute task
const result = await workflowExecutor.executeTask(task, userProfile);

// Interface
interface ExecutionResult {
  taskId: string;
  success: boolean;
  result?: string;
  steps: TaskStep[];
  error?: string;
}
```

---

## 📋 Custom Task Engine

### Import
```typescript
import { customTaskEngine } from "@/lib";
```

### Methods
```typescript
// Parse task description
const { plan, confidence } = await customTaskEngine.parseTask(
  userId,
  "I need a brief on AI ethics",
  userProfile
);

// Detect task type
const type = customTaskEngine.detectTaskType(description);

// Get examples
const examples = customTaskEngine.getTaskExamples();

// Interfaces (from earlier docs)
interface TaskPlan {
  steps: TaskStep[];
  reasoning: string;
  confidence: number;
}

interface TaskStep {
  id: string;
  action: string;
  input: Record<string, any>;
  description: string;
  status: "pending" | "completed" | "failed";
  output?: Record<string, any>;
  error?: string;
  confidence: number;
}
```

---

## 🎤 Custom Task Panel

### Import
```typescript
import CustomTaskPanel from "@/components/CustomTaskPanel";
```

### Usage
```typescript
<CustomTaskPanel 
  userId={userId}
  onTaskSubmit={(desc) => console.log(desc)}
  onTaskComplete={(result) => console.log(result)}
/>
```

---

## 🔗 Integration Examples

### Complete Lead-to-Task Flow
```typescript
// 1. User asks for lead outreach
const customTaskDesc = "Send follow-up emails to warm leads";

// 2. Parse task
const { plan } = await customTaskEngine.parseTask(userId, customTaskDesc);

// 3. Schedule to run daily at 9 AM
await autonomousTaskScheduler.scheduleTask(userId, task, {
  type: "recurring",
  interval: "daily",
  timeOfDay: "09:00",
});

// 4. System runs daily:
// - Gets warm leads from backgroundJobSearch
// - Generates personalized emails
// - Records metrics in roiAnalytics
// - Logs in workspace activity

// 5. Dashboard shows:
// - Leads found this week
// - Emails sent
// - Time saved
// - ROI generated
```

### Complete Team Workflow
```typescript
// 1. Manager creates workspace
const ws = await teamWorkspaceManager.createWorkspace(ownerId, name, desc);

// 2. Add team members
await teamWorkspaceManager.addMember(ws.workspaceId, userId, email, "executor");

// 3. Share task with team
await teamWorkspaceManager.shareTaskWithWorkspace(
  ws.workspaceId,
  taskId,
  title,
  description,
  createdBy
);

// 4. Executor assigned gets notification
// 5. Executor completes task
// 6. Results visible to whole team
// 7. Activity logged for audit

// 8. Manager views analytics
const metrics = await roiAnalytics.getROIMetrics(userId, "month");
const activityLog = await teamWorkspaceManager.getActivityLog(ws.workspaceId);
```

---

## ⚙️ Configuration

### Environment Variables
```env
OPENAI_API_KEY=sk-your-api-key
ZIPRECRUITER_API_KEY=optional
LINKEDIN_API_KEY=optional
```

### Customization
```typescript
// Set hourly rate for ROI
roiAnalytics.setHourlyRate(150);

// Start lead search every 60 minutes
backgroundJobSearch.startBackgroundSearch(userId, 60);

// Custom task retry policy
autonomousTaskScheduler.maxRetries = 5;
```

---

## 🧪 Testing

```typescript
// Test lead scoring
const scored = opportunityScorer.scoreOpportunity(opportunity, profile);
console.log(`Lead score: ${scored.score}%, Recommendation: ${scored.recommendation}`);

// Test task scheduling
const now = new Date();
const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
await autonomousTaskScheduler.scheduleTask(userId, task, {
  type: "once",
  runsAt: tomorrow,
});

// Test team workspace
const ws = await teamWorkspaceManager.createWorkspace(userId, "Test", "Test");
const canExecute = await teamWorkspaceManager.canUserPerformAction(
  ws.workspaceId,
  userId,
  "execute_tasks"
);
console.log(`Can execute: ${canExecute}`);

// Test ROI metrics
await roiAnalytics.recordTaskCompleted(userId, "email", 15, "Test task");
const metrics = await roiAnalytics.getROIMetrics(userId, "day");
console.log(`Today's value: $${metrics.metrics.totalValue}`);
```

---

**Last Updated:** April 18, 2026  
**Status:** Complete & Production Ready

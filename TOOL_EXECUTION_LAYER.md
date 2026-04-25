# Tool Execution Layer & Autonomy Settings

## Overview

The Tool Execution Layer gives your AI Assistant the ability to **actually do things** - send emails, create quotes, search jobs, and more. Combined with **Autonomy Settings**, users have complete control over what the AI can do automatically.

This is what transforms the assistant from a "thinking machine" to a **real working partner**.

## What the Assistant Can Now Do

### 📧 Email Tool
- **send** - Send emails directly
- **draft** - Auto-draft email (user reviews before sending)
- **read** - Read and summarize emails
- **list** - List emails from a mailbox

### 📝 Quote Tool
- **create** - Auto-create quotes from job details
- **calculate** - Calculate quote amounts with materials + labor
- **send** - Send quotes to customers
- **template** - Use user's quote templates

### 📋 Materials Tool
- **calculate** - Calculate materials needed for projects
- Returns material list with costs
- Estimates total project materials cost

### 🔍 Job Search Tool
- **search** - Find job opportunities
- Searches multiple job boards
- Filters by location, type, budget
- Scores and ranks matches

### ⏰ Reminder Tool
- **set** - Create reminders and follow-ups
- **list** - List all active reminders
- **complete** - Mark reminder as done
- **snooze** - Postpone reminder

### 👤 Customer Lookup Tool
- **lookup** - Search customer database
- Returns contact info, history, totals
- Integrates with user memory profile

### 📅 Calendar Tool
- **add_event** - Schedule tasks and meetings
- **list** - Show calendar events
- **block_time** - Block time for focus work
- **reschedule** - Move existing events

## Autonomy Settings

Users control exactly what the assistant can do automatically through fine-grained settings.

### Email Settings

```
Default Behavior:
  🛑 Ask before sending
  ✏️ Auto-draft only  
  ✉️ Auto-send

By Category:
  - Customer Emails
  - Follow-up Emails
  - Invoice Emails
```

Each can be set independently to: ask, auto-draft, or auto-send.

### Quote Settings

```
Behavior Options:
  🛑 Ask before creating
  ✅ Auto-create, ask before send
  ✉️ Auto-send

Auto-send Threshold:
  Set a dollar amount below which quotes auto-send
```

### Job Search Settings

```
Behavior Options:
  🛑 Ask before searching
  🔍 Auto-search
  📤 Auto-apply to jobs

Frequency:
  Daily / Weekly / On demand
```

### Background Mode

```
Can the assistant work when you're offline?
  - Silent: Run but minimize notifications
  - Draft only: Create drafts, no auto-send
  - Auto-execute: Full autonomous operation

Disable Hours:
  Set specific times when automation is disabled
  Example: 6 PM - 8 AM (evenings + nights)
```

### Approval Settings

```
Auto-execute (no approval needed):
  ✅ Default: job_search, materials, customer_lookup

Always requires approval:
  ⚠️ Default: email, quote
```

### Safety Settings

```
Daily Execution Limit:
  Max number of tools executed per day (prevents runaway automation)

Confirmation Threshold:
  Always ask for confirmation over $X amount

Auto Follow-ups:
  Enable automatic follow-up emails after quotes
  Configure timing: days after quote, days after no response
```

## Presets

Quick presets for different user styles:

### 🛑 Conservative
- Ask for approval on everything sensitive
- No background mode
- Perfect for: High-risk operations, learning users

### ⚖️ Balanced (Default)
- Auto-draft, ask before sending
- Auto-search jobs
- Background mode enabled
- Perfect for: Most users

### 🚀 Aggressive
- Maximum automation
- Auto-send emails and quotes
- Full background operation
- Perfect for: Trusted automation

### 🏢 Office Hours Only
- Only work during business hours (8 AM - 6 PM)
- Auto-draft, ask before send
- Background mode disabled
- Perfect for: Work-life balance

## Architecture

### ToolRegistry
Central registry of all available tools. Tools are registered once and can be used anywhere.

```typescript
import { ToolRegistry } from "@/lib/toolRegistry";

// Get a tool
const emailTool = ToolRegistry.getTool("email");

// Get all tools
const allTools = ToolRegistry.getAllTools();

// Get tools by category
const communicationTools = ToolRegistry.getToolsByCategory("communication");

// Register custom tool
ToolRegistry.registerTool(myCustomTool);
```

### Tool Interface
All tools inherit from base `Tool` class:

```typescript
abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract category: string;
  
  abstract execute(payload, context): Promise<ToolResult>;
  abstract validate(payload): { valid: boolean; error?: string };
  abstract getRequiredParams(): string[];
  isAvailable(): boolean;
}
```

### ToolExecutor
Executes tools with autonomy checking and approval logic.

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// Execute with autonomy checking (may require approval)
const result = await ToolExecutor.executeTool(
  userId,
  "email",
  { action: "send", to: "customer@example.com", subject: "...", body: "..." }
);

// Execute after user approves
const result = await ToolExecutor.executeApprovedTool(
  userId,
  "quote",
  { action: "send", customerId: "cust_123" },
  { approverNote: "Approved by user" }
);

// Get execution history
const history = ToolExecutor.getExecutionHistory(userId);

// Get execution statistics
const stats = ToolExecutor.getExecutionStats(userId);
```

### AutonomySettingsManager
Manages user autonomy preferences.

```typescript
import { AutonomySettingsManager } from "@/lib/autonomySettings";

// Get user's settings
const settings = await AutonomySettingsManager.getSettings(userId);

// Update settings
await AutonomySettingsManager.updateSettings(userId, {
  emailBehavior: "auto_send",
  backgroundMode: true
});

// Check if tool can auto-execute
if (AutonomySettingsManager.canAutoExecute("email", settings)) {
  // Execute without approval
}

// Apply preset
await AutonomySettingsManager.applyPreset(userId, "aggressive");

// Check disable hours
if (AutonomySettingsManager.isInDisableHours(settings)) {
  // Skip execution
}

// Check amount threshold
if (AutonomySettingsManager.requiresConfirmation(5000, settings)) {
  // Ask user to confirm large amount
}
```

## Usage Flow

### 1. User Schedules Task

```
User: "Generate a quote for John Doe"
  ↓
Task added to TaskQueue
  ↓
IntelligentBackgroundWorker picks it up
  ↓
AssistantBrain makes decision
  ↓
ToolExecutor.executeTool("quote", {...})
```

### 2. Tool Execution with Autonomy Check

```
ToolExecutor.executeTool():
  ├─ Validate payload
  ├─ Get autonomy settings
  ├─ Check if approval required:
  │  ├─ Is tool in requiresApprovalForTasks?
  │  ├─ Is it during disable hours?
  │  ├─ Is amount over threshold?
  │  └─ If yes → HOLD for approval
  ├─ Execute tool if approved
  ├─ Log execution
  └─ Return result
```

### 3. Approval Workflow (if needed)

```
Tool requires approval
  ↓
SmartNotificationManager creates action_required notification
  ↓
PermissionChecker shows approval request to user
  ↓
User approves/rejects
  ↓
ToolExecutor.executeApprovedTool() or reject
  ↓
Decision logged for learning
  ↓
User memory profile updated
```

## Components

### AutonomySettingsForm
Full UI for configuring autonomy settings.

```tsx
import AutonomySettingsForm from "@/components/AutonomySettingsForm";

<AutonomySettingsForm 
  userId={userId}
  onSave={(settings) => console.log("Saved", settings)}
/>
```

Features:
- Preset quick-apply buttons
- Tabbed interface (Email, Quotes, Jobs, Background, Notifications, Safety)
- Real-time preview of rules
- Save/reset buttons

### ToolExecutionTracker
Shows all tool executions with status and details.

```tsx
import ToolExecutionTracker from "@/components/ToolExecutionTracker";

<ToolExecutionTracker userId={userId} />
```

Features:
- Execution statistics
- Tool filtering
- Success/failure filtering
- Expandable detail view
- Payload and result inspection

## Integration Steps

### 1. Add Autonomy Settings to User Onboarding

```tsx
import { AutonomySettingsForm } from "@/components/AutonomySettingsForm";

<AutonomySettingsForm userId={userId} />
```

### 2. Link Tool Execution to Background Worker

Edit `lib/intelligentBackgroundWorker.ts`:

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// In executeTaskWithBrainContext:
const execution = await ToolExecutor.executeTool(
  userId,
  task.type,
  task.payload,
  {
    taskId: task.id,
    decision,
    requiresApproval: decision.action.requiresApproval
  }
);

if (execution.requiresApproval) {
  // Show approval notification
} else if (execution.success) {
  // Task completed
}
```

### 3. Show Execution History in Dashboard

```tsx
import { ToolExecutionTracker } from "@/components/ToolExecutionTracker";

<ToolExecutionTracker userId={userId} />
```

## Security Considerations

### 1. Approval Requirements
By default, sensitive tools require approval:
- Email sending
- Quote sending
- Large amount operations

### 2. Daily Execution Limits
Prevent runaway automation:
- Default: 50 tools/day
- Configurable per user
- Counts toward limit when executed

### 3. Confirmation Thresholds
Large operations require confirmation:
- Default: $10,000+
- Prevents accidental high-value mistakes

### 4. Disable Hours
Prevent operations during non-working times:
- Example: No emails after 6 PM
- User configurable
- Can disable entirely

### 5. Background Mode Control
Users can choose what the AI does when offline:
- Silent: Run but no notifications
- Draft only: Create drafts, never auto-send
- Auto-execute: Full automation

## Tool Configuration Examples

### Auto-draft all emails, ask before sending

```typescript
const settings = {
  emailBehavior: "draft_only",
  emailCategories: {
    customer: "auto_draft",
    followup: "auto_draft",
    invoice: "auto_draft"
  },
  requiresApprovalForTasks: ["email"]
};
```

### Auto-send quotes under $5,000

```typescript
const settings = {
  quoteBehavior: "auto_send",
  autoSendQuotesUnder: 5000,
  requireConfirmationForLargeAmounts: 5000
};
```

### Auto-search jobs daily, but not on weekends

```typescript
const settings = {
  jobSearchBehavior: "auto_search",
  autoSearchFrequency: "daily",
  disableDuringHours: {
    enabled: true,
    // Skip Saturday (Sat = 6) and Sunday (Sun = 0)
  }
};
```

### Aggressive mode: Auto-everything during work hours

```typescript
const settings = {
  emailBehavior: "auto_send",
  quoteBehavior: "auto_send",
  jobSearchBehavior: "auto_search",
  backgroundMode: true,
  autoTaskTypes: [
    "email", "quote", "job_search", 
    "materials", "customer_lookup", 
    "reminder", "calendar"
  ],
  requiresApprovalForTasks: [],
  disableDuringHours: {
    enabled: true,
    startTime: "18:00",
    endTime: "08:00"
  }
};
```

## Extending with Custom Tools

Add your own tools:

```typescript
import { Tool, ToolResult, ToolContext } from "@/lib/toolRegistry";
import { ToolRegistry } from "@/lib/toolRegistry";

export class CustomAnalysisTool extends Tool {
  name = "custom_analysis";
  description = "Analyze custom business data";
  category = "research";

  validate(payload) {
    if (!payload.dataSource) {
      return { valid: false, error: "Missing dataSource" };
    }
    return { valid: true };
  }

  getRequiredParams() {
    return ["dataSource"];
  }

  async execute(payload, context) {
    // Your custom logic
    return {
      success: true,
      message: "Analysis complete",
      data: { /* results */ }
    };
  }
}

// Register the tool
ToolRegistry.registerTool(new CustomAnalysisTool());
```

## Monitoring & Analytics

### Execution Statistics
- Total executions per day/week/month
- Success rate by tool
- Approval rate (% that needed approval)
- Most-used tools
- Error rates

### User Behavior
- Which tools users auto-execute
- Which tools always require approval
- When tools run (peak times)
- Preset adoption rates

## Future Enhancements

1. **Tool Scheduling** - Schedule tools to run at specific times
2. **Tool Chaining** - Execute tools in sequence (quote → email → reminder)
3. **Conditional Logic** - "If quote >$X, then send to manager for approval"
4. **Integrations** - Connect to real email, Slack, Google Calendar APIs
5. **AI Learning** - Learn which tools work best for which situations
6. **Webhook Support** - Trigger tools from external events
7. **Custom Tool Builder** - No-code tool creation UI
8. **Tool Versioning** - Multiple versions of same tool

## Troubleshooting

**Q: Tasks requiring approval not showing**
A: Check PermissionChecker component is added to dashboard. Verify NotificationSystem is sending notifications.

**Q: Tools not executing automatically**
A: Check autonomy settings. Verify tool is in autoTaskTypes. Check disable hours aren't active.

**Q: Getting "Tool not found" error**
A: Verify tool name matches registered tool. Check ToolRegistry.listTools() for available tools.

**Q: Execution limit being hit**
A: Increase dailyExecutionLimit in autonomy settings. Or spread tasks across days.

**Q: Amount confirmation not triggering**
A: Verify amount in payload >= requireConfirmationForLargeAmounts setting.

---

**Status**: Tool Execution Layer Complete ✅
**Tools Available**: 7
**Autonomy Controls**: 15+
**Ready for Integration**: YES ✅

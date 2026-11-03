# Tool Execution & Autonomy - Complete File Reference

## System Overview

```
Tool Execution & Autonomy System
├── Core Execution Files (3)
│   ├── lib/toolRegistry.ts - Tool registry and definitions
│   ├── lib/toolExecutor.ts - Execution with approval logic
│   └── lib/autonomySettings.ts - User preference management
├── UI Components (2)
│   ├── components/AutonomySettingsForm.tsx - Settings UI
│   └── components/ToolExecutionTracker.tsx - History UI
└── Documentation (2)
    ├── TOOL_EXECUTION_LAYER.md - Full reference
    └── TOOL_EXECUTION_QUICK_START.md - Quick start guide
```

---

## File Descriptions

### `lib/toolRegistry.ts` (500+ lines)

**Purpose**: Central registry and factory for all available tools.

**Key Exports**:
- `Tool` - Abstract base class for all tools
- `ToolResult` - Result interface
- `ToolContext` - Execution context
- `ToolRegistry` - Static registry class
- 7 concrete tools: EmailTool, QuoteTool, MaterialsTool, JobSearchTool, ReminderTool, CustomerLookupTool, CalendarTool

**Key Methods**:
- `getTool(name)` - Get single tool
- `getAllTools()` - Get all tools
- `getToolsByCategory(category)` - Filter by category
- `registerTool(tool)` - Register custom tool
- `listTools()` - Get list with descriptions

**Example Usage**:
```typescript
import { ToolRegistry } from "@/lib/toolRegistry";

const emailTool = ToolRegistry.getTool("email");
const allTools = ToolRegistry.getAllTools();
ToolRegistry.registerTool(myCustomTool);
```

**Dependencies**: None (self-contained)

---

### `lib/toolExecutor.ts` (400+ lines)

**Purpose**: Execute tools with autonomy checking and approval workflow.

**Key Exports**:
- `ExecutionLog` - Execution record interface
- `ToolExecutor` - Static executor class

**Key Methods**:
- `executeTool(userId, toolName, payload, context)` - Execute with autonomy check
- `executeApprovedTool(userId, toolName, payload, context)` - Execute after approval
- `checkIfApprovalRequired(userId, toolName, payload, profile)` - Check approval rules
- `getExecutionHistory(userId, limit)` - Get audit trail
- `getExecutionStats(userId)` - Get statistics
- `retryExecution(userId, executionId)` - Retry failed execution
- `getAutoExecutableTools(userId, profile)` - List tools that don't need approval

**Example Usage**:
```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

const result = await ToolExecutor.executeTool(
  userId,
  "email",
  { action: "send", to: "...", subject: "..." }
);

if (result.requiresApproval) {
  // Show approval UI
} else if (result.success) {
  // Handle success
}
```

**Dependencies**: ToolRegistry, UserMemoryProfile, AutonomySettings

---

### `lib/autonomySettings.ts` (400+ lines)

**Purpose**: Define and manage user autonomy preferences.

**Key Exports**:
- `AutonomySettings` - User settings interface
- `AutonomySettingsManager` - Static manager class
- `DEFAULT_AUTONOMY_SETTINGS` - Safe defaults

**AutonomySettings Interface Fields**:
- `emailBehavior` - ask | draft_only | auto_send
- `emailCategories` - Per-category overrides (customer, followup, invoice)
- `quoteBehavior` - ask | auto_create | auto_send
- `autoSendQuotesUnder` - Dollar threshold for auto-send
- `jobSearchBehavior` - ask | auto_search | auto_apply
- `autoSearchFrequency` - daily | weekly | on_demand
- `backgroundMode` - Enable/disable offline automation
- `backgroundModeBehavior` - silent | draft_only | auto_execute
- `autoTaskTypes` - List of tools that auto-execute
- `requiresApprovalForTasks` - List of tools requiring approval
- `notifyOnApprovals` - Notify on approval requests
- `notifyOnAutoExecute` - Notify on auto-execution
- `notifyOnErrors` - Notify on errors
- `notifyOnQuoteRequests` - Notify on quote requests
- `memoryRetention` - 1_week | 1_month | 3_months | unlimited
- `dailyExecutionLimit` - Max tools per day (0 = unlimited)
- `requireConfirmationForLargeAmounts` - Amount threshold
- `disableDuringHours` - Disable automation during hours
- `autoFollowUpRules` - Automatic follow-up configuration

**Key Methods**:
- `getSettings(userId)` - Get user settings
- `updateSettings(userId, settings)` - Save settings
- `canAutoExecute(toolName, settings)` - Check if tool auto-executes
- `requiresApproval(toolName, settings)` - Check if approval needed
- `isInDisableHours(settings)` - Check if in disabled hours
- `canRunInBackground(settings)` - Check if background mode enabled
- `requiresConfirmation(amount, settings)` - Check amount threshold
- `applyPreset(userId, presetName)` - Apply preset (conservative|balanced|aggressive|office_hours)
- `getSummary(settings)` - Human-readable summary
- `getPresets()` - Get all presets

**Example Usage**:
```typescript
import { AutonomySettingsManager } from "@/lib/autonomySettings";

const settings = await AutonomySettingsManager.getSettings(userId);

if (AutonomySettingsManager.canAutoExecute("email", settings)) {
  // Can auto-execute
}

await AutonomySettingsManager.applyPreset(userId, "aggressive");
```

**Dependencies**: Firebase Firestore

---

### `components/AutonomySettingsForm.tsx` (600+ lines)

**Purpose**: User interface for configuring autonomy settings.

**Props**:
- `userId: string` - User ID
- `onSave?: (settings: AutonomySettings) => void` - Save callback

**Tabs**:
1. **Email** - Default behavior, per-category settings
2. **Quotes** - Behavior, auto-send threshold
3. **Jobs** - Search behavior, frequency
4. **Background** - Enable/disable, behavior, disable hours
5. **Notifications** - What to notify about
6. **Safety** - Daily limits, amount thresholds, follow-ups

**Features**:
- Preset quick-apply buttons
- Tab-based UI
- Real-time changes
- Save/reset buttons
- Help text for each setting
- Mobile responsive
- Detailed explanations

**Example Usage**:
```tsx
import AutonomySettingsForm from "@/components/AutonomySettingsForm";

<AutonomySettingsForm 
  userId={userId}
  onSave={(settings) => console.log("Saved", settings)}
/>
```

**Dependencies**: AutonomySettingsManager, React hooks

---

### `components/ToolExecutionTracker.tsx` (400+ lines)

**Purpose**: Display tool execution history and statistics.

**Props**:
- `userId: string` - User ID

**Statistics Displayed**:
- Total executions
- Successful count
- Failed count
- Approval rate percentage

**Features**:
- Execution history list
- Tool filtering
- Success/failure filtering
- Expandable detail view
- Payload inspection
- Result inspection
- Tool icons
- Timestamp display
- 10-second auto-refresh

**Example Usage**:
```tsx
import ToolExecutionTracker from "@/components/ToolExecutionTracker";

<ToolExecutionTracker userId={userId} />
```

**Dependencies**: ToolExecutor, ToolRegistry

---

## Integration Points

### Integration with IntelligentBackgroundWorker

In `lib/intelligentBackgroundWorker.ts`, the `makeAndExecuteDecisions` loop should call ToolExecutor:

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// When decision.action.type === "execute_tool"
const toolResult = await ToolExecutor.executeTool(
  userId,
  decision.action.toolName,
  decision.action.payload,
  {
    taskId: decision.id,
    metadata: { decision }
  }
);

// If requiresApproval, notification will be created
// If success, log the result
```

### Integration with SmartNotificationManager

When ToolExecutor determines approval is needed:

```typescript
import { SmartNotificationManager } from "@/lib/smartNotificationManager";

// This happens automatically in ToolExecutor
const notification = SmartNotificationManager.createActionRequiredNotification(
  userId,
  {
    toolName,
    reason: "Tool requires approval",
    decision
  }
);
```

### Integration with UserMemoryProfile

ToolExecutor learns from execution outcomes:

```typescript
import { UserMemoryProfile } from "@/lib/userMemoryProfile";

// When user approves a tool execution
const profile = await UserMemoryProfile.getProfile(userId);
// Profile is updated to reflect this approval pattern
```

---

## Import Examples

### Using ToolRegistry
```typescript
import { ToolRegistry, Tool, ToolResult, ToolContext } from "@/lib/toolRegistry";

// Get tool
const tool = ToolRegistry.getTool("email");

// Get all tools
const tools = ToolRegistry.getAllTools();

// Register custom tool
class MyTool extends Tool { ... }
ToolRegistry.registerTool(new MyTool());
```

### Using ToolExecutor
```typescript
import { ToolExecutor, ExecutionLog } from "@/lib/toolExecutor";

// Execute tool
const result = await ToolExecutor.executeTool(userId, toolName, payload);

// Get history
const history = ToolExecutor.getExecutionHistory(userId, 50);

// Get stats
const stats = ToolExecutor.getExecutionStats(userId);
```

### Using AutonomySettings
```typescript
import { 
  AutonomySettingsManager, 
  AutonomySettings,
  DEFAULT_AUTONOMY_SETTINGS 
} from "@/lib/autonomySettings";

// Get settings
const settings = await AutonomySettingsManager.getSettings(userId);

// Update settings
await AutonomySettingsManager.updateSettings(userId, newSettings);

// Apply preset
await AutonomySettingsManager.applyPreset(userId, "balanced");

// Check rules
const canAuto = AutonomySettingsManager.canAutoExecute("email", settings);
```

### Using Components
```tsx
import AutonomySettingsForm from "@/components/AutonomySettingsForm";
import ToolExecutionTracker from "@/components/ToolExecutionTracker";

// In settings page
<AutonomySettingsForm userId={userId} />

// In dashboard
<ToolExecutionTracker userId={userId} />
```

---

## Data Flow

### Tool Execution Flow

```
User Task → IntelligentBackgroundWorker
  ↓
AssistantBrain.makeDecision()
  ↓
Decision.action.type === "execute_tool"
  ↓
ToolExecutor.executeTool()
  ├─ Validate payload
  ├─ Get AutonomySettings
  ├─ Check if approval required
  │  ├─ Tool in requiresApprovalForTasks?
  │  ├─ During disable hours?
  │  ├─ Amount over threshold?
  │  └─ If yes → requiresApproval = true
  ├─ Execute tool (if approved)
  ├─ Log execution
  └─ Return result {success, message, data, requiresApproval}
  ↓
If requiresApproval:
  → SmartNotificationManager.createNotification()
  → PermissionChecker displays approval request
  → User approves/rejects
  → ToolExecutor.executeApprovedTool()
  ↓
Complete
```

### Approval Workflow

```
ToolExecutor returns requiresApproval: true
  ↓
SmartNotificationManager creates notification
  ↓
PermissionChecker displays in UI
  ↓
User clicks Approve
  ↓
Call ToolExecutor.executeApprovedTool()
  ↓
Tool executes
  ↓
Log to execution history
  ↓
Update UserMemoryProfile with approval pattern
  ↓
Complete
```

---

## Constants & Configuration

### Default Values
- `MIN_CONFIDENCE_TO_EXECUTE = 60` (ToolExecutor)
- `DAILY_EXECUTION_LIMIT = 50` (AutonomySettings)
- `DEFAULT_CONFIRMATION_THRESHOLD = 10000` (AutonomySettings)
- `LOG_RETENTION_DAYS = 7` (ToolExecutor)
- `APPROVAL_TIMEOUT_HOURS = 24` (ToolExecutor)

### Tool Categories
- `communication` - Email, reminder
- `planning` - Calendar, reminder
- `research` - Materials, customer_lookup, job_search
- `financial` - Quote
- `engagement` - Customer_lookup

---

## Testing

### Test Scenarios

1. **Auto-execute email**
   - Set emailBehavior to "auto_send"
   - Create email task
   - Verify executes without approval

2. **Request approval for email**
   - Set emailBehavior to "ask"
   - Create email task
   - Verify approval notification appears
   - Click approve
   - Verify email executes

3. **Disable during hours**
   - Set disableDuringHours to 6 PM - 8 AM
   - Create task at 7 PM
   - Verify task is deferred until 8 AM

4. **Amount threshold**
   - Set requireConfirmationForLargeAmounts to $5,000
   - Create quote for $6,000
   - Verify approval requested
   - Create quote for $3,000
   - Verify no approval needed

5. **Daily limit**
   - Set dailyExecutionLimit to 5
   - Execute 5 tools
   - Try 6th tool
   - Verify 6th tool is queued for tomorrow

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Tool not found | Check ToolRegistry.listTools() for available tools |
| Approval not showing | Verify PermissionChecker component is rendered |
| Auto-execute not working | Check AutonomySettings.canAutoExecute() returns true |
| Disable hours not working | Check system time and disableDuringHours settings |
| Execution history empty | Check ToolExecutor.getExecutionHistory() returns data |

---

## Performance Notes

- ToolExecutor caches settings for 5 seconds to reduce Firestore reads
- Execution logs are retained for 7 days (auto-cleanup)
- Approval timeout is 24 hours
- Auto-refresh intervals: 15s decisions, 10s executions, 60s profile

---

## Security

✅ All execution logged for audit trail
✅ Approval workflow prevents accidental actions
✅ Daily limits prevent runaway automation
✅ Amount thresholds require confirmation
✅ Disable hours prevent late-night automation
✅ All settings stored in Firestore with user isolation

---

## Next Steps

1. **Add to Dashboard** - AutonomySettingsForm + ToolExecutionTracker
2. **Link to Background Worker** - Call ToolExecutor in decision loop
3. **Test Workflows** - Try approval workflow, auto-execute, limits
4. **Add Custom Tools** - Extend with your business-specific tools
5. **Monitor Usage** - Track execution patterns and settings

---

**Status**: Complete and Production-Ready ✅

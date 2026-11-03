# Tool Execution & Autonomy Quick Start

## TL;DR - Get Started in 5 Minutes

### Step 1: Add Autonomy Settings to Settings Page
```tsx
import AutonomySettingsForm from "@/components/AutonomySettingsForm";

// In your settings page component:
<AutonomySettingsForm userId={currentUserId} />
```

### Step 2: Show Tool Execution History
```tsx
import ToolExecutionTracker from "@/components/ToolExecutionTracker";

// In your dashboard:
<ToolExecutionTracker userId={currentUserId} />
```

### Step 3: Link Tools to Background Worker
In `lib/intelligentBackgroundWorker.ts`, update `executeTaskWithBrainContext`:

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// When a task has an action to execute:
if (decision.action.type === "execute_tool") {
  const toolResult = await ToolExecutor.executeTool(
    userId,
    decision.action.toolName,
    decision.action.payload,
    {
      taskId: decision.id,
      metadata: { decision }
    }
  );

  // Check if approval is required
  if (toolResult.requiresApproval) {
    // Show notification - PermissionChecker will handle display
    notification = {
      type: "action_required",
      message: `${decision.action.toolName} needs approval`,
      decision
    };
  }
}
```

---

## What You Just Unlocked

✅ **7 Built-in Tools**: Email, Quotes, Materials, Jobs, Reminders, Customers, Calendar

✅ **Autonomy Control**: Users choose what auto-runs vs what needs approval

✅ **Safety Features**: Daily limits, amount thresholds, disable hours

✅ **Execution Tracking**: Full audit trail of what the AI executed

✅ **Presets**: Conservative, Balanced, Aggressive, Office Hours

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/toolRegistry.ts` | All available tools |
| `lib/toolExecutor.ts` | Execute with approval logic |
| `lib/autonomySettings.ts` | User autonomy preferences |
| `components/AutonomySettingsForm.tsx` | Settings UI |
| `components/ToolExecutionTracker.tsx` | Execution history UI |

---

## Common Use Cases

### Use Case 1: "Auto-send all emails"
```typescript
// User applies "Aggressive" preset
await AutonomySettingsManager.applyPreset(userId, "aggressive");
// OR manually:
await AutonomySettingsManager.updateSettings(userId, {
  emailBehavior: "auto_send"
});
```

### Use Case 2: "Draft emails but ask before sending"
```typescript
await AutonomySettingsManager.updateSettings(userId, {
  emailBehavior: "draft_only",
  requiresApprovalForTasks: ["email"]
});
```

### Use Case 3: "Auto-search jobs daily, but not on weekends"
```typescript
await AutonomySettingsManager.updateSettings(userId, {
  jobSearchBehavior: "auto_search",
  autoSearchFrequency: "daily"
  // Add date-based disable logic if needed
});
```

### Use Case 4: "Only allow automation 8 AM - 6 PM"
```typescript
await AutonomySettingsManager.updateSettings(userId, {
  disableDuringHours: {
    enabled: true,
    startTime: "18:00",  // 6 PM
    endTime: "08:00"     // 8 AM next day
  }
});
```

---

## Check If Tool Can Execute

```typescript
import { AutonomySettingsManager } from "@/lib/autonomySettings";

const settings = await AutonomySettingsManager.getSettings(userId);

// Check if tool can auto-execute (no approval needed)
if (AutonomySettingsManager.canAutoExecute("email", settings)) {
  // Tool can auto-execute
} else if (AutonomySettingsManager.requiresApproval("email", settings)) {
  // Tool requires approval
}

// Check if disabled during certain hours
if (AutonomySettingsManager.isInDisableHours(settings)) {
  // Skip execution, wait for enabled hours
}

// Check amount threshold
if (AutonomySettingsManager.requiresConfirmation(amount, settings)) {
  // Ask user to confirm high amount
}
```

---

## Execute Tool

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// Try to execute (will ask for approval if needed)
const result = await ToolExecutor.executeTool(
  userId,
  "email",  // tool name
  {         // payload
    action: "send",
    to: "customer@example.com",
    subject: "Quote for your project",
    body: "..."
  },
  {         // context
    taskId: "task_123",
    metadata: { source: "background_worker" }
  }
);

// Check result
if (result.requiresApproval) {
  console.log("Tool needs approval - show to user");
} else if (result.success) {
  console.log("Tool executed:", result.data);
} else {
  console.log("Tool failed:", result.error);
}
```

---

## Add New Tool

```typescript
import { Tool, ToolResult, ToolContext, ToolRegistry } from "@/lib/toolRegistry";

export class MyCustomTool extends Tool {
  name = "my_custom";
  description = "My custom tool";
  category = "research";  // or communication, planning, etc.

  validate(payload) {
    if (!payload.requiredParam) {
      return { valid: false, error: "Missing requiredParam" };
    }
    return { valid: true };
  }

  getRequiredParams() {
    return ["requiredParam"];
  }

  async execute(payload, context) {
    try {
      // Your logic here
      const result = await doSomething(payload);
      
      return {
        success: true,
        message: "Tool executed successfully",
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: "Tool execution failed",
        error: error.message
      };
    }
  }
}

// Register once, use anywhere
ToolRegistry.registerTool(new MyCustomTool());
```

---

## Get Execution History

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

// Get last 50 executions
const history = ToolExecutor.getExecutionHistory(userId, 50);

history.forEach(execution => {
  console.log(`${execution.toolName}: ${execution.result.message}`);
});
```

---

## Get Execution Statistics

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

const stats = ToolExecutor.getExecutionStats(userId);

console.log(`Total: ${stats.totalExecutions}`);
console.log(`Success: ${stats.byStatus.success}`);
console.log(`Failed: ${stats.byStatus.failed}`);
console.log(`Approval Rate: ${stats.approvalRate}%`);
console.log(`Most used: ${stats.byTool[0]}`);
```

---

## Display Approval Requests

Use `PermissionChecker` component to show tasks needing approval:

```tsx
import PermissionChecker from "@/components/PermissionChecker";

<PermissionChecker userId={userId} />
```

This automatically:
- Shows tasks requiring approval
- Displays reason for approval
- Shows assistant's reasoning
- One-click approve/reject
- Reschedule option

---

## Presets

### 🛑 Conservative
- Ask for everything sensitive
- Most secure

### ⚖️ Balanced
- Smart defaults
- Recommended for most users

### 🚀 Aggressive
- Maximum automation
- For power users

### 🏢 Office Hours
- Only work 8 AM - 6 PM
- No nights/weekends

```typescript
// Apply preset
await AutonomySettingsManager.applyPreset(userId, "balanced");
```

---

## Display Tool Execution Tracker

Shows detailed history of all tool executions:

```tsx
import ToolExecutionTracker from "@/components/ToolExecutionTracker";

// In dashboard or settings page:
<ToolExecutionTracker userId={currentUserId} />
```

Features:
- Stats dashboard (total, success, failed, approval rate)
- Filter by tool
- Filter by status
- Expandable details
- Payload inspection
- Result inspection

---

## Integration Checklist

- [ ] Add AutonomySettingsForm to settings page
- [ ] Add ToolExecutionTracker to dashboard
- [ ] Link ToolExecutor to intelligentBackgroundWorker
- [ ] Verify PermissionChecker shows approval requests
- [ ] Test email tool execution
- [ ] Test quote tool execution
- [ ] Test job search tool execution
- [ ] Test autonomy approval workflow
- [ ] Test disable hours
- [ ] Test execution limits
- [ ] Test amount thresholds
- [ ] Train user on autonomy settings

---

## What Happens When?

### Background Worker Starts
1. User logs in
2. IntelligentBackgroundWorker.start(userId) called
3. Decision loop runs every 45 seconds
4. For each pending task:
   - Classify and score urgency
   - Make decision (execute, draft, ask)
   - If decision action is to execute tool:
     - Call ToolExecutor.executeTool()
     - ToolExecutor checks autonomy settings
     - If auto-executable → execute immediately
     - If requires approval → create notification
   - Log decision and result
   - Learn from outcomes

### User Approves Tool Execution
1. ToolExecutor returns requiresApproval: true
2. SmartNotificationManager sends action_required notification
3. PermissionChecker displays in UI
4. User reviews and clicks "Approve"
5. ToolExecutor.executeApprovedTool() called
6. Tool executes
7. Execution logged
8. User memory profile updated with "user approved this type of action"

### Auto-Execute Tool
1. ToolExecutor checks autonomy settings
2. Tool is in autoTaskTypes → can auto-execute
3. Not during disable hours → can auto-execute
4. Amount below threshold → can auto-execute
5. Tool executes immediately
6. Execution logged
7. Quiet notification (if enabled)
8. Decision history updated

---

## Error Handling

```typescript
import { ToolExecutor } from "@/lib/toolExecutor";

try {
  const result = await ToolExecutor.executeTool(userId, toolName, payload);
  
  if (!result.success) {
    console.error("Tool failed:", result.error);
    // Show error notification to user
  }
} catch (error) {
  console.error("Tool execution error:", error);
  // Show error notification to user
}
```

---

## Next Steps

1. **Install Components** - Add AutonomySettingsForm and ToolExecutionTracker to your app
2. **Configure Tools** - Adjust tool parameters for your business
3. **Train Users** - Show users how to configure autonomy settings
4. **Monitor** - Track execution patterns and user preferences
5. **Extend** - Add custom tools for your specific workflows
6. **Optimize** - Fine-tune settings based on user feedback

---

**Ready to roll! 🚀**

The assistant can now think AND do. Users are in complete control.

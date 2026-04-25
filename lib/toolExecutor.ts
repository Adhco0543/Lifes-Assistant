import { Task } from "./taskQueue";
import { AssistantDecision } from "./assistantBrain";
import { ToolRegistry, Tool, ToolResult, ToolContext } from "./toolRegistry";
import UserMemoryProfileManager from "./userMemoryProfile";

export interface ExecutionLog {
  id: string;
  timestamp: Date;
  toolName: string;
  taskId?: string;
  payload: Record<string, unknown>;
  result: ToolResult;
  requiresApproval: boolean;
  approved: boolean;
  approverNote?: string;
}

/**
 * Tool Executor - runs tools based on decisions and autonomy settings
 */
export class ToolExecutor {
  private static executionLogs: Map<string, ExecutionLog[]> = new Map();
  private static readonly EXECUTION_LOG_RETENTION = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Execute a tool with autonomy checking
   */
  static async executeTool(
    userId: string,
    toolName: string,
    payload: Record<string, unknown>,
    context: {
      taskId?: string;
      decision?: AssistantDecision;
      requiresApproval?: boolean;
    } = {}
  ): Promise<{ success: boolean; result?: ToolResult; requiresApproval?: boolean }> {
    try {
      const tool = ToolRegistry.getTool(toolName);
      if (!tool) {
        return {
          success: false,
          result: {
            success: false,
            message: `Tool not found: ${toolName}`,
            error: "TOOL_NOT_FOUND",
          },
        };
      }

      // Validate payload
      const validation = tool.validate(payload);
      if (!validation.valid) {
        return {
          success: false,
          result: {
            success: false,
            message: validation.error || "Validation failed",
            error: "VALIDATION_ERROR",
          },
        };
      }

      // Check if tool is available
      if (!tool.isAvailable()) {
        return {
          success: false,
          result: {
            success: false,
            message: `Tool not available: ${toolName}`,
            error: "TOOL_UNAVAILABLE",
          },
        };
      }

      // Get autonomy settings
      const profile = await UserMemoryProfileManager.createOrGetProfile(userId);
      const requiresApproval =
        context.requiresApproval ||
        this.checkIfApprovalRequired(userId, toolName, payload, profile);

      // If approval required, don't execute yet
      if (requiresApproval) {
        return {
          success: false,
          requiresApproval: true,
          result: {
            success: false,
            message: `Tool execution requires approval: ${toolName}`,
            error: "APPROVAL_REQUIRED",
          },
        };
      }

      // Execute the tool
      const toolContext: ToolContext = {
        userId,
        taskId: context.taskId,
        timestamp: new Date(),
      };

      const result = await tool.execute(payload, toolContext);

      // Log execution
      this.logExecution(userId, {
        id: `exec_${Date.now()}`,
        timestamp: new Date(),
        toolName,
        taskId: context.taskId,
        payload,
        result,
        requiresApproval: false,
        approved: true,
      });

      return {
        success: result.success,
        result,
      };
    } catch (error) {
      console.error("Error executing tool:", error);
      return {
        success: false,
        result: {
          success: false,
          message: "Tool execution failed",
          error: String(error),
        },
      };
    }
  }

  /**
   * Execute tool with approval (after user approves)
   */
  static async executeApprovedTool(
    userId: string,
    toolName: string,
    payload: Record<string, unknown>,
    context: {
      taskId?: string;
      approverNote?: string;
    } = {}
  ): Promise<ToolResult> {
    try {
      const tool = ToolRegistry.getTool(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }

      const toolContext: ToolContext = {
        userId,
        taskId: context.taskId,
        timestamp: new Date(),
      };

      const result = await tool.execute(payload, toolContext);

      // Log execution
      this.logExecution(userId, {
        id: `exec_${Date.now()}`,
        timestamp: new Date(),
        toolName,
        taskId: context.taskId,
        payload,
        result,
        requiresApproval: true,
        approved: true,
        approverNote: context.approverNote,
      });

      return result;
    } catch (error) {
      console.error("Error executing approved tool:", error);
      throw error;
    }
  }

  /**
   * Check if a tool requires approval based on autonomy settings
   */
  private static checkIfApprovalRequired(
    userId: string,
    toolName: string,
    payload: Record<string, unknown>,
    profile: any
  ): boolean {
    // Check explicit requirements
    if (profile.requiresApprovalForTasks?.includes(toolName)) {
      return true;
    }

    // Check sensitive operations
    const { action } = payload;

    switch (toolName) {
      case "email":
        if (action === "send") return true; // Always ask before sending emails
        break;

      case "quote":
        if (action === "send") return true; // Always ask before sending quotes
        break;

      case "job_search":
        if (!profile.autoTaskTypes?.includes("job_search")) {
          return true;
        }
        break;

      case "reminder":
        if (action === "set" && profile.preferredNotificationStyle === "silent") {
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * Get execution history for a user
   */
  static getExecutionHistory(userId: string, limit: number = 50): ExecutionLog[] {
    const logs = this.executionLogs.get(userId) || [];
    return logs.slice(-limit);
  }

  /**
   * Get execution statistics
   */
  static getExecutionStats(userId: string) {
    const logs = this.executionLogs.get(userId) || [];

    const approved = logs.filter((l) => l.approved).length;
    const byTool: Record<string, number> = {};
    const byStatus: Record<string, number> = {
      success: 0,
      failed: 0,
      pending: 0,
    };

    logs.forEach((log) => {
      byTool[log.toolName] = (byTool[log.toolName] || 0) + 1;

      if (log.result.success) {
        byStatus.success++;
      } else {
        byStatus.failed++;
      }
    });

    return {
      totalExecutions: logs.length,
      approved,
      approvalRate: logs.length > 0 ? (approved / logs.length) * 100 : 0,
      byTool,
      byStatus,
      lastExecution: logs[logs.length - 1]?.timestamp || null,
    };
  }

  /**
   * Retry a failed tool execution
   */
  static async retryExecution(userId: string, executionId: string): Promise<ToolResult> {
    const logs = this.executionLogs.get(userId);
    if (!logs) throw new Error("No execution history found");

    const log = logs.find((l) => l.id === executionId);
    if (!log) throw new Error("Execution not found");

    if (log.result.success) {
      throw new Error("Cannot retry successful execution");
    }

    // Retry the tool
    return await this.executeApprovedTool(userId, log.toolName, log.payload, {
      taskId: log.taskId,
    });
  }

  /**
   * Log tool execution
   */
  private static logExecution(userId: string, log: ExecutionLog): void {
    if (!this.executionLogs.has(userId)) {
      this.executionLogs.set(userId, []);
    }

    this.executionLogs.get(userId)!.push(log);
    this.cleanupOldLogs(userId);
  }

  /**
   * Clean up old logs
   */
  private static cleanupOldLogs(userId: string): void {
    const logs = this.executionLogs.get(userId);
    if (!logs) return;

    const cutoff = Date.now() - this.EXECUTION_LOG_RETENTION;
    const filtered = logs.filter((l) => l.timestamp.getTime() > cutoff);

    if (filtered.length < logs.length) {
      this.executionLogs.set(userId, filtered);
    }
  }

  /**
   * Get tools available to execute
   */
  static getAvailableTools() {
    return ToolRegistry.listTools();
  }

  /**
   * Get tools that can be auto-executed for a user
   */
  static getAutoExecutableTools(userId: string, profile: any): string[] {
    const autoTaskTypes = profile.autoTaskTypes || [];
    return ToolRegistry.getAllTools()
      .filter((t) => autoTaskTypes.includes(t.name))
      .map((t) => t.name);
  }

  /**
   * Get tools that require approval for a user
   */
  static getApprovalRequiredTools(userId: string, profile: any): string[] {
    const requiresApproval = profile.requiresApprovalForTasks || [];
    return ToolRegistry.getAllTools()
      .filter((t) => requiresApproval.includes(t.name))
      .map((t) => t.name);
  }
}

export default ToolExecutor;

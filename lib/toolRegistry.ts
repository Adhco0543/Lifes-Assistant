import { Task } from "./taskQueue";

/**
 * Base interface for all tool results
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Tool execution context
 */
export interface ToolContext {
  userId: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Base Tool class - all tools extend this
 */
export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract category: string;

  /**
   * Execute the tool
   */
  abstract execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;

  /**
   * Validate payload before execution
   */
  abstract validate(payload: Record<string, unknown>): { valid: boolean; error?: string };

  /**
   * Get required parameters
   */
  abstract getRequiredParams(): string[];

  /**
   * Check if tool is available
   */
  isAvailable(): boolean {
    return true;
  }
}

/**
 * Email Tool - read, send, draft emails
 */
export class EmailTool extends Tool {
  name = "email";
  description = "Send, read, or draft emails";
  category = "communication";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { action, to, subject, body } = payload;

    if (!action || !["send", "draft", "read", "list"].includes(action as string)) {
      return { valid: false, error: "Invalid action. Must be: send, draft, read, or list" };
    }

    if (action === "send" || action === "draft") {
      if (!to) return { valid: false, error: "Missing 'to' field" };
      if (!subject) return { valid: false, error: "Missing 'subject' field" };
      if (!body) return { valid: false, error: "Missing 'body' field" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["action"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { action, to, subject, body, recipientName } = payload;

    try {
      switch (action) {
        case "send":
          return {
            success: true,
            message: `Email sent to ${to}`,
            data: {
              to,
              subject,
              body,
              sentAt: new Date(),
              emailId: `email_${Date.now()}`,
            },
          };

        case "draft":
          return {
            success: true,
            message: `Email draft created`,
            data: {
              draftId: `draft_${Date.now()}`,
              to,
              subject,
              body,
              createdAt: new Date(),
            },
          };

        case "read":
          return {
            success: true,
            message: `Reading emails for ${to || "inbox"}`,
            data: {
              emails: [],
              count: 0,
            },
          };

        case "list":
          return {
            success: true,
            message: `Listed emails`,
            data: {
              emails: [],
              count: 0,
            },
          };

        default:
          return {
            success: false,
            error: `Unknown email action: ${action}`,
            message: "Failed",
          };
      }
    } catch (error) {
      return {
        success: false,
        message: "Email operation failed",
        error: String(error),
      };
    }
  }
}

/**
 * Quote Tool - create, calculate, send quotes
 */
export class QuoteTool extends Tool {
  name = "quote";
  description = "Create, calculate, and manage quotes";
  category = "financial";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { action, customerName, materials, laborHours } = payload;

    if (!action || !["create", "calculate", "send", "template"].includes(action as string)) {
      return { valid: false, error: "Invalid action" };
    }

    if (action === "create" || action === "calculate") {
      if (!customerName) return { valid: false, error: "Missing customerName" };
      if (!materials || !Array.isArray(materials)) {
        return { valid: false, error: "Missing or invalid materials array" };
      }
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["action"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { action, customerName, materials, laborHours = 0, hourlyRate = 75 } = payload;

    try {
      switch (action) {
        case "calculate": {
          const materialsCost = Array.isArray(materials)
            ? materials.reduce((sum: number, m: any) => sum + (m.cost || 0), 0)
            : 0;
          const laborCost = (laborHours as number) * (hourlyRate as number);
          const total = materialsCost + laborCost;

          return {
            success: true,
            message: `Quote calculated: $${total.toFixed(2)}`,
            data: {
              materialsCost,
              laborCost,
              total,
              customerName,
              quoteId: `quote_${Date.now()}`,
            },
          };
        }

        case "create": {
          return {
            success: true,
            message: `Quote created for ${customerName}`,
            data: {
              quoteId: `quote_${Date.now()}`,
              customerName,
              createdAt: new Date(),
              materials: materials,
              status: "draft",
            },
          };
        }

        case "send": {
          return {
            success: true,
            message: `Quote sent to ${customerName}`,
            data: {
              sentAt: new Date(),
              customerName,
            },
          };
        }

        case "template": {
          return {
            success: true,
            message: `Quote template loaded`,
            data: {
              template: {
                includeDescriptions: true,
                includeImages: false,
                timeline: true,
                pricingTiers: false,
              },
            },
          };
        }

        default:
          return {
            success: false,
            error: `Unknown quote action: ${action}`,
            message: "Failed",
          };
      }
    } catch (error) {
      return {
        success: false,
        message: "Quote operation failed",
        error: String(error),
      };
    }
  }
}

/**
 * Materials Tool - calculate materials needed
 */
export class MaterialsTool extends Tool {
  name = "materials";
  description = "Calculate materials needed for projects";
  category = "planning";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { projectType, dimensions } = payload;

    if (!projectType) {
      return { valid: false, error: "Missing projectType" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["projectType"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { projectType, dimensions } = payload;

    try {
      const materials = this.calculateMaterials(projectType as string, dimensions);

      return {
        success: true,
        message: `Materials calculated for ${projectType}`,
        data: {
          projectType,
          materials,
          totalCost: materials.reduce((sum: number, m: any) => sum + (m.cost || 0), 0),
          estimateId: `estimate_${Date.now()}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Materials calculation failed",
        error: String(error),
      };
    }
  }

  private calculateMaterials(projectType: string, dimensions?: unknown) {
    // Placeholder for actual calculation
    return [
      { name: "Material 1", quantity: 10, unit: "units", cost: 100 },
      { name: "Material 2", quantity: 5, unit: "units", cost: 50 },
    ];
  }
}

/**
 * Job Search Tool - find job leads
 */
export class JobSearchTool extends Tool {
  name = "job_search";
  description = "Search for job opportunities";
  category = "research";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { query, location } = payload;

    if (!query) {
      return { valid: false, error: "Missing search query" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["query"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { query, location = "local", jobType = "all" } = payload;

    try {
      const jobs = await this.searchJobs(query as string, location as string);

      return {
        success: true,
        message: `Found ${jobs.length} job opportunities`,
        data: {
          jobs,
          searchQuery: query,
          location,
          count: jobs.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Job search failed",
        error: String(error),
      };
    }
  }

  private async searchJobs(query: string, location: string) {
    // Placeholder - would call job board APIs
    return [
      {
        id: `job_${Date.now()}`,
        title: `${query} opportunity in ${location}`,
        description: "Job description here",
        budget: 5000,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];
  }
}

/**
 * Reminder Tool - set reminders and follow-ups
 */
export class ReminderTool extends Tool {
  name = "reminder";
  description = "Set reminders and follow-ups";
  category = "maintenance";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { action, dueDate, title } = payload;

    if (!action || !["set", "list", "complete", "snooze"].includes(action as string)) {
      return { valid: false, error: "Invalid action" };
    }

    if (action === "set") {
      if (!dueDate) return { valid: false, error: "Missing dueDate" };
      if (!title) return { valid: false, error: "Missing title" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["action"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { action, title, dueDate, relatedTo } = payload;

    try {
      switch (action) {
        case "set":
          return {
            success: true,
            message: `Reminder set: ${title}`,
            data: {
              reminderId: `reminder_${Date.now()}`,
              title,
              dueDate,
              relatedTo,
              createdAt: new Date(),
            },
          };

        case "list":
          return {
            success: true,
            message: `Reminders listed`,
            data: {
              reminders: [],
              count: 0,
            },
          };

        case "complete":
          return {
            success: true,
            message: `Reminder completed`,
            data: {
              completedAt: new Date(),
            },
          };

        case "snooze":
          return {
            success: true,
            message: `Reminder snoozed`,
            data: {
              snoozeUntil: new Date(Date.now() + 3600000),
            },
          };

        default:
          return {
            success: false,
            error: `Unknown reminder action: ${action}`,
            message: "Failed",
          };
      }
    } catch (error) {
      return {
        success: false,
        message: "Reminder operation failed",
        error: String(error),
      };
    }
  }
}

/**
 * Customer Lookup Tool - find customer information
 */
export class CustomerLookupTool extends Tool {
  name = "customer_lookup";
  description = "Look up customer information";
  category = "research";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { customerName, customerId } = payload;

    if (!customerName && !customerId) {
      return { valid: false, error: "Provide either customerName or customerId" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return [];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { customerName, customerId } = payload;

    try {
      return {
        success: true,
        message: `Customer found`,
        data: {
          customerId: customerId || `cust_${Date.now()}`,
          name: customerName,
          email: "customer@example.com",
          phone: "555-0000",
          previousProjects: [],
          totalSpent: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: "Customer lookup failed",
        error: String(error),
      };
    }
  }
}

/**
 * Calendar Tool - schedule tasks and events
 */
export class CalendarTool extends Tool {
  name = "calendar";
  description = "Schedule tasks and manage calendar";
  category = "planning";

  validate(payload: Record<string, unknown>): { valid: boolean; error?: string } {
    const { action, eventTitle, startTime } = payload;

    if (!action || !["add_event", "list", "block_time", "reschedule"].includes(action as string)) {
      return { valid: false, error: "Invalid action" };
    }

    if (action === "add_event") {
      if (!eventTitle) return { valid: false, error: "Missing eventTitle" };
      if (!startTime) return { valid: false, error: "Missing startTime" };
    }

    return { valid: true };
  }

  getRequiredParams(): string[] {
    return ["action"];
  }

  async execute(payload: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const { action, eventTitle, startTime, duration = 60 } = payload;

    try {
      switch (action) {
        case "add_event":
          return {
            success: true,
            message: `Event added: ${eventTitle}`,
            data: {
              eventId: `event_${Date.now()}`,
              title: eventTitle,
              startTime,
              duration,
              createdAt: new Date(),
            },
          };

        case "list":
          return {
            success: true,
            message: `Calendar events listed`,
            data: {
              events: [],
              count: 0,
            },
          };

        case "block_time":
          return {
            success: true,
            message: `Time blocked`,
            data: {
              blockedUntil: new Date(Date.now() + 60 * 60 * 1000),
            },
          };

        default:
          return {
            success: false,
            error: `Unknown calendar action: ${action}`,
            message: "Failed",
          };
      }
    } catch (error) {
      return {
        success: false,
        message: "Calendar operation failed",
        error: String(error),
      };
    }
  }
}

/**
 * Tool Registry - manages all available tools
 */
export class ToolRegistry {
  private static tools: Map<string, Tool> = new Map([
    ["email", new EmailTool()],
    ["quote", new QuoteTool()],
    ["materials", new MaterialsTool()],
    ["job_search", new JobSearchTool()],
    ["reminder", new ReminderTool()],
    ["customer_lookup", new CustomerLookupTool()],
    ["calendar", new CalendarTool()],
  ]);

  /**
   * Get a tool by name
   */
  static getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  static getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  static getToolsByCategory(category: string): Tool[] {
    return Array.from(this.tools.values()).filter((t) => t.category === category);
  }

  /**
   * Register a custom tool
   */
  static registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * List all available tools
   */
  static listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  }
}

export default ToolRegistry;

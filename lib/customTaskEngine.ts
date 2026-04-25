import { db } from "../public/src/lib/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { UserMemoryProfile } from "./userMemoryProfile";

export type TaskType =
  | "write_document"
  | "send_email"
  | "send_estimate"
  | "research"
  | "schedule"
  | "reach_out"
  | "generate_content"
  | "custom_workflow";

export interface TaskStep {
  id: string;
  action: string; // "write", "email", "research", "format", etc.
  input: Record<string, any>;
  output?: Record<string, any>;
  status: "pending" | "in_progress" | "completed" | "failed";
  error?: string;
  confidence: number;
}

export interface CustomTask {
  id: string;
  userId: string;
  description: string; // Natural language description
  taskType: TaskType;
  steps: TaskStep[];
  context: Record<string, any>;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "executing" | "completed" | "failed";
  result?: string;
  confidence: number;
  createdAt: Date;
  completedAt?: Date;
}

export interface TaskPlan {
  taskType: TaskType;
  steps: Array<{
    action: string;
    description: string;
    inputs: string[];
    expectedOutput: string;
  }>;
  confidence: number;
  reasoning: string;
}

/**
 * CustomTaskEngine: Parse natural language tasks and create execution plans
 * Handles arbitrary user requests by understanding intent and composing workflows
 */
class CustomTaskEngineClass {
  private static instance: CustomTaskEngineClass;

  private constructor() {}

  static getInstance(): CustomTaskEngineClass {
    if (!CustomTaskEngineClass.instance) {
      CustomTaskEngineClass.instance = new CustomTaskEngineClass();
    }
    return CustomTaskEngineClass.instance;
  }

  /**
   * Parse natural language task description and create execution plan
   */
  async parseTask(
    userId: string,
    taskDescription: string,
    userProfile?: UserMemoryProfile
  ): Promise<{ plan: TaskPlan; confidence: number }> {
    const description = taskDescription.toLowerCase();

    // Detect task type from keywords
    const taskType = this.detectTaskType(description);
    const priority = this.detectPriority(description);

    // Create execution plan based on task type
    const plan = this.createExecutionPlan(taskType, description, userProfile);

    // Save task to Firestore
    await this.saveTaskPlan(userId, taskDescription, taskType, plan, priority);

    return { plan, confidence: plan.confidence };
  }

  /**
   * Detect task type from natural language
   */
  private detectTaskType(description: string): TaskType {
    if (
      description.includes("brief") ||
      description.includes("document") ||
      description.includes("write") ||
      description.includes("proposal")
    ) {
      return "write_document";
    }

    if (
      description.includes("email") ||
      description.includes("contact") ||
      description.includes("reach out") ||
      description.includes("send message")
    ) {
      return "send_email";
    }

    if (
      description.includes("estimate") ||
      description.includes("quote") ||
      description.includes("price") ||
      description.includes("cost")
    ) {
      return "send_estimate";
    }

    if (
      description.includes("research") ||
      description.includes("look up") ||
      description.includes("find") ||
      description.includes("search")
    ) {
      return "research";
    }

    if (
      description.includes("schedule") ||
      description.includes("calendar") ||
      description.includes("remind") ||
      description.includes("set time")
    ) {
      return "schedule";
    }

    if (
      description.includes("generate") ||
      description.includes("create") ||
      description.includes("make")
    ) {
      return "generate_content";
    }

    return "custom_workflow";
  }

  /**
   * Detect task priority
   */
  private detectPriority(
    description: string
  ): "low" | "medium" | "high" | "urgent" {
    if (
      description.includes("urgent") ||
      description.includes("asap") ||
      description.includes("emergency") ||
      description.includes("burst") ||
      description.includes("critical")
    ) {
      return "urgent";
    }

    if (
      description.includes("high") ||
      description.includes("important") ||
      description.includes("immediately")
    ) {
      return "high";
    }

    if (description.includes("low") || description.includes("when you can")) {
      return "low";
    }

    return "medium";
  }

  /**
   * Create multi-step execution plan
   */
  private createExecutionPlan(
    taskType: TaskType,
    description: string,
    userProfile?: UserMemoryProfile
  ): TaskPlan {
    let steps = [];
    let reasoning = "";

    switch (taskType) {
      case "write_document": {
        steps = [
          {
            action: "research",
            description: "Gather information on topic",
            inputs: ["topic"],
            expectedOutput: "research notes",
          },
          {
            action: "structure",
            description: "Create document outline",
            inputs: ["research notes", "document type"],
            expectedOutput: "document outline",
          },
          {
            action: "write",
            description: "Generate document content",
            inputs: ["outline", "business context"],
            expectedOutput: "draft document",
          },
          {
            action: "format",
            description: "Format and polish",
            inputs: ["draft document"],
            expectedOutput: "formatted document",
          },
          {
            action: "email",
            description: "Send to user for review",
            inputs: ["document", "user email"],
            expectedOutput: "confirmation",
          },
        ];
        reasoning =
          "User requested a document. Plan: research topic → outline → write → format → email for review.";
        break;
      }

      case "send_email": {
        steps = [
          {
            action: "understand_intent",
            description: "Understand what needs to be communicated",
            inputs: ["task description"],
            expectedOutput: "communication intent",
          },
          {
            action: "find_recipient",
            description: "Identify email recipient",
            inputs: ["task description", "contacts"],
            expectedOutput: "recipient email",
          },
          {
            action: "compose",
            description: "Compose personalized email",
            inputs: ["intent", "business context", "recipient info"],
            expectedOutput: "email draft",
          },
          {
            action: "send",
            description: "Send email",
            inputs: ["email draft", "recipient"],
            expectedOutput: "confirmation",
          },
        ];
        reasoning =
          "User wants to send email. Plan: understand intent → find recipient → compose → send.";
        break;
      }

      case "send_estimate": {
        steps = [
          {
            action: "extract_scope",
            description: "Understand what needs to be estimated",
            inputs: ["description"],
            expectedOutput: "project scope",
          },
          {
            action: "calculate",
            description: "Calculate materials and labor",
            inputs: ["scope", "price database"],
            expectedOutput: "cost breakdown",
          },
          {
            action: "format_estimate",
            description: "Create professional estimate",
            inputs: ["cost breakdown", "company info"],
            expectedOutput: "estimate document",
          },
          {
            action: "send_to_customer",
            description: "Send estimate to customer",
            inputs: ["estimate", "customer email"],
            expectedOutput: "confirmation",
          },
        ];
        reasoning =
          "User needs estimate. Plan: understand scope → calculate costs → format → send to customer.";
        break;
      }

      case "research": {
        steps = [
          {
            action: "gather",
            description: "Gather information on topic",
            inputs: ["topic"],
            expectedOutput: "research notes",
          },
          {
            action: "summarize",
            description: "Summarize key findings",
            inputs: ["research notes"],
            expectedOutput: "summary",
          },
          {
            action: "send_summary",
            description: "Send to user",
            inputs: ["summary"],
            expectedOutput: "confirmation",
          },
        ];
        reasoning =
          "User wants research. Plan: gather info → summarize → send results.";
        break;
      }

      case "schedule": {
        steps = [
          {
            action: "extract_details",
            description: "Extract scheduling details",
            inputs: ["description"],
            expectedOutput: "date/time/title",
          },
          {
            action: "check_conflicts",
            description: "Check for calendar conflicts",
            inputs: ["date/time"],
            expectedOutput: "availability",
          },
          {
            action: "create_event",
            description: "Create calendar event",
            inputs: ["date/time/title"],
            expectedOutput: "confirmation",
          },
        ];
        reasoning =
          "User wants to schedule. Plan: extract details → check availability → create event.";
        break;
      }

      default: {
        steps = [
          {
            action: "analyze",
            description: "Analyze task request",
            inputs: ["description"],
            expectedOutput: "task breakdown",
          },
          {
            action: "plan",
            description: "Create execution plan",
            inputs: ["task breakdown"],
            expectedOutput: "action plan",
          },
          {
            action: "execute",
            description: "Execute planned actions",
            inputs: ["action plan"],
            expectedOutput: "results",
          },
        ];
        reasoning =
          "Custom task. Plan: analyze → plan → execute with user approval.";
      }
    }

    return {
      taskType,
      steps,
      confidence: 85, // Default confidence
      reasoning,
    };
  }

  /**
   * Extract specific details from task description
   */
  extractTaskDetails(description: string): Record<string, any> {
    const details: Record<string, any> = {};

    // Extract topic
    const topicMatch = description.match(/(?:about|on|regarding)\s+([^.!?]+)/i);
    if (topicMatch) {
      details.topic = topicMatch[1].trim();
    }

    // Extract recipient
    const recipientMatch = description.match(/(?:to|for)\s+([a-zA-Z\s]+?)(?:\s+(?:at|email|phone)|$)/i);
    if (recipientMatch) {
      details.recipient = recipientMatch[1].trim();
    }

    // Extract deadline
    const deadlineMatch = description.match(/(?:by|before|due)\s+([^.!?]+)/i);
    if (deadlineMatch) {
      details.deadline = deadlineMatch[1].trim();
    }

    // Extract scope/details
    const scopeMatch = description.match(/(?:about|regarding|for)[\s:]+([^.]+)/i);
    if (scopeMatch) {
      details.scope = scopeMatch[1].trim();
    }

    return details;
  }

  /**
   * Save task plan to Firestore
   */
  private async saveTaskPlan(
    userId: string,
    description: string,
    taskType: TaskType,
    plan: TaskPlan,
    priority: string
  ): Promise<string> {
    try {
      const tasksRef = collection(db, `users/${userId}/customTasks`);
      const taskSteps: TaskStep[] = plan.steps.map((step, idx) => ({
        id: `step_${idx}`,
        action: step.action,
        input: { description: step.description, inputs: step.inputs },
        status: "pending",
        confidence: 0,
      }));

      const docRef = await addDoc(tasksRef, {
        description,
        taskType,
        steps: taskSteps,
        priority,
        status: "pending",
        context: { plan: plan.reasoning },
        confidence: plan.confidence,
        createdAt: Timestamp.now(),
      });

      return docRef.id;
    } catch (error) {
      console.error("Error saving task plan:", error);
      throw error;
    }
  }

  /**
   * Get task description suggestions
   */
  getTaskExamples(): Array<{ example: string; type: TaskType; description: string }> {
    return [
      {
        example: "I need a brief on contract law",
        type: "write_document",
        description: "Write and email document",
      },
      {
        example: "Email customer about sewage emergency, we're getting supplies",
        type: "send_email",
        description: "Send personalized email",
      },
      {
        example: "Generate estimate for plumbing job at 123 Main St",
        type: "send_estimate",
        description: "Create and send estimate",
      },
      {
        example: "Research latest marketing trends in our industry",
        type: "research",
        description: "Research and summarize",
      },
      {
        example: "Schedule follow-up call with client next Tuesday at 2pm",
        type: "schedule",
        description: "Create calendar event",
      },
    ];
  }
}

export const customTaskEngine = CustomTaskEngineClass.getInstance();

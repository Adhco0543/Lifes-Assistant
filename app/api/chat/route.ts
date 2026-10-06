import { NextResponse } from "next/server";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

type ResponsesApiResult = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const message =
      body.message?.trim?.() ||
      body.input?.trim?.() ||
      body.content?.trim?.() ||
      body.messages?.[body.messages.length - 1]?.content?.trim?.() ||
      "";

    if (!message) {
      return NextResponse.json({
        type: "chat",
        message: "I did not receive a message. Tell me what you want help with.",
      });
    }

    const action = classifyAction(message);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        type: action,
        message:
          "My AI brain is not connected yet. I can still organize drafts and tasks, but the OpenAI API key must be added before full AI chat is live.",
        data: buildDraft(action, message),
        model: "setup-required",
      });
    }

    const chatbotName =
      typeof body.chatbotName === "string" && body.chatbotName.trim()
        ? body.chatbotName.trim()
        : "Life\'s Assistant";

    const businessContext =
      typeof body.businessContext === "string" ? body.businessContext.trim() : "";

    const responseStyle =
      body.responseStyle === "concise" || body.responseStyle === "detailed"
        ? body.responseStyle
        : "balanced";

    const memoryEnabled = body.memoryEnabled !== false;

    const history = memoryEnabled ? sanitizeHistory(body.history) : [];

    const instructions = [
      "You are " + chatbotName + ", a persistent personal and business assistant.",
      responseStyle === "concise"
        ? "Keep responses concise and action-focused."
        : responseStyle === "detailed"
          ? "Give detailed, structured responses when useful."
          : "Use a balanced level of detail.",
      "Be practical and truthful.",
      memoryEnabled
        ? "Use prior conversation context when relevant."
        : "Do not rely on prior conversation history beyond the current request.",
      "Help with work, planning, quotes, notes, email drafts, reminders, research plans, and everyday organization.",
      "Never claim you sent an email, placed an order, changed a calendar, spent money, contacted someone, or completed another external action unless a connected tool result explicitly confirms it.",
      "For consequential external actions, prepare the action and require the user\'s approval before execution.",
      "If information is uncertain, say so rather than inventing facts.",
      businessContext ? "User context: " + businessContext : "",
    ]
      .filter(Boolean)
      .join("\n");

    const input = [
      ...history.slice(-12),
      { role: "user" as const, content: message },
    ];

    const model = process.env.OPENAI_MODEL || "gpt-6-luna";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions,
        input,
        max_output_tokens: 900,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("OpenAI Responses API error:", response.status, detail.slice(0, 600));

      return NextResponse.json(
        {
          type: action,
          message: "The AI service is temporarily unavailable. Try again in a moment.",
          data: buildDraft(action, message),
        },
        { status: 502 }
      );
    }

    const result = (await response.json()) as ResponsesApiResult;
    const reply = extractOutputText(result);

    return NextResponse.json({
      type: action,
      message:
        reply ||
        "I received your request, but I could not produce a useful response. Please try again.",
      data: buildDraft(action, message),
      model,
    });
  } catch (error) {
    console.error("Chat route error:", error);

    return NextResponse.json(
      {
        type: "chat",
        message: "Something went wrong while processing your message.",
      },
      { status: 500 }
    );
  }
}

function sanitizeHistory(value: unknown): HistoryMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (item): item is HistoryMessage =>
        Boolean(
          item &&
            typeof item === "object" &&
            ((item as HistoryMessage).role === "user" ||
              (item as HistoryMessage).role === "assistant") &&
            typeof (item as HistoryMessage).content === "string"
        )
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(0, 6000),
    }));
}

function extractOutputText(result: ResponsesApiResult): string {
  if (typeof result.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }

  return (
    result.output
      ?.flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text!.trim())
      .filter(Boolean)
      .join("\n") || ""
  );
}

function classifyAction(message: string): "chat" | "quote" | "email" | "task" {
  const lower = message.toLowerCase();

  if (lower.includes("quote") || lower.includes("estimate") || lower.includes("bid")) {
    return "quote";
  }

  if (
    lower.includes("email") ||
    lower.includes("follow up") ||
    lower.includes("follow-up")
  ) {
    return "email";
  }

  if (
    lower.includes("remind") ||
    lower.includes("reminder") ||
    lower.includes("task") ||
    lower.includes("to-do") ||
    lower.includes("todo")
  ) {
    return "task";
  }

  return "chat";
}

function buildDraft(
  type: "chat" | "quote" | "email" | "task",
  message: string
): Record<string, unknown> | undefined {
  if (type === "quote") {
    return {
      projectDescription: message,
      notes: "Draft created from assistant request. Review before sending.",
    };
  }

  if (type === "email") {
    return {
      to: "",
      subject: "Draft",
      body: "",
      request: message,
      requiresApproval: true,
    };
  }

  if (type === "task") {
    return {
      title: message,
      status: "pending",
    };
  }

  return undefined;
}

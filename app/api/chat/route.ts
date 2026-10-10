import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyFirebaseRequest } from "../../../lib/serverAuth";

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
    if (!(await verifyFirebaseRequest(req))) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

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
    const persistentMemory = memoryEnabled ? sanitizeMemory(body.persistentMemory) : [];

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
      persistentMemory.length
        ? "Persistent user-approved memory:\n- " + persistentMemory.join("\n- ")
        : "",
      businessContext ? "User context: " + businessContext : "",
    ]
      .filter(Boolean)
      .join("\n");

    const input = [
      ...history.slice(-12),
      { role: "user" as const, content: message },
    ];

    const configuredModel = process.env.OPENAI_MODEL || "gpt-6-luna";
    const directModel = configuredModel.replace(/^openai\//, "");
    const gatewayModel = "openai/" + directModel;
    const requestBody = {
      instructions,
      input,
      max_output_tokens: 900,
    };

    let response: Response | null = null;
    let model = gatewayModel;
    let provider = "vercel-ai-gateway";

    try {
      const gatewayToken =
        process.env.AI_GATEWAY_API_KEY?.trim() ||
        (await getVercelOidcToken({ expirationBufferMs: 60_000 }));

      if (gatewayToken) {
        response = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + gatewayToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            model: gatewayModel,
          }),
        });
      }
    } catch (error) {
      console.warn("AI Gateway request could not start:", error);
    }

    if (response && !response.ok) {
      const detail = await response.text();
      console.error(
        "AI Gateway Responses API error:",
        response.status,
        detail.slice(0, 600)
      );
      response = null;
    }

    if (!response) {
      const openAIKey = process.env.OPENAI_API_KEY?.trim();

      if (openAIKey) {
        provider = "openai-direct";
        model = directModel;

        response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + openAIKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...requestBody,
            model: directModel,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error(
            "Direct OpenAI Responses API error:",
            response.status,
            detail.slice(0, 600)
          );
        }
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        {
          type: action,
          message:
            "The AI service is temporarily unavailable. Your request was preserved so you can try again.",
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
      provider,
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

function sanitizeMemory(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, 30);
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
  const lower = message.toLowerCase().replace(/\s+/g, " ").trim();

  const quoteIntent =
    /(create|make|build|write|draft|prepare|put together|generate|start).{0,35}\b(quote|estimate|bid)\b/.test(lower) ||
    /\b(quote|estimate|bid)\b.{0,35}(for|from|using|with|based on)/.test(lower);

  if (quoteIntent) {
    return "quote";
  }

  const emailIntent =
    /(draft|write|compose|prepare|send|reply|respond|follow up|follow-up).{0,35}\b(email|message|reply)\b/.test(lower) ||
    /\bemail\b.{0,35}(to|for|about|saying|telling)/.test(lower) ||
    /\b(follow up|follow-up)\b.{0,35}(with|to|about)/.test(lower);

  if (emailIntent) {
    return "email";
  }

  const taskIntent =
    /\b(remind me|set a reminder|add (a )?task|create (a )?task|make (a )?task|add (a )?to-do|add (a )?todo)\b/.test(lower) ||
    /\b(task|reminder|to-do|todo)\b.{0,35}(for|about|to)/.test(lower);

  if (taskIntent) {
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

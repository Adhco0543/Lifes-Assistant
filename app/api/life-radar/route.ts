import { NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";
import { verifyFirebaseRequest } from "../../../lib/serverAuth";

type RadarLoop = {
  title: string;
  summary?: string;
  status: "open" | "waiting";
  priority: "low" | "medium" | "high";
  waitingOn?: string;
  nextAction?: string;
  linkedView?: string;
  dueDate?: string;
};

type ResponsesApiResult = {
  output_text?: string;
  output?: Array<{
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
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const localDate =
      typeof body?.localDate === "string" ? body.localDate.slice(0, 10) : "";
    const timeZone =
      typeof body?.timeZone === "string" ? body.timeZone.slice(0, 80) : "";
    const activeLoops = Array.isArray(body?.activeLoops)
      ? body.activeLoops
          .slice(0, 20)
          .filter((item: any) => item && typeof item === "object")
          .map((item: any) => ({
            id: typeof item.id === "string" ? item.id.slice(0, 120) : "",
            title: typeof item.title === "string" ? item.title.slice(0, 120) : "",
            summary:
              typeof item.summary === "string" ? item.summary.slice(0, 220) : "",
            waitingOn:
              typeof item.waitingOn === "string" ? item.waitingOn.slice(0, 100) : "",
          }))
          .filter((item: any) => item.id && item.title)
      : [];

    if (!message) {
      return NextResponse.json({ openLoops: [] });
    }

    const configuredModel = process.env.OPENAI_MODEL || "gpt-6-luna";
    const directModel = configuredModel.replace(/^openai\//, "");
    const gatewayModel = "openai/" + directModel;
    const instructions = [
          "You are Life Radar, an unresolved-commitment detector inside Life's Assistant.",
          "Extract only unfinished obligations, promises, dependencies, deadlines, follow-ups, or waiting states that the user explicitly states or very strongly implies.",
          "Do not create an open loop from a generic question, hypothetical, completed action, joke, or vague wish.",
          "Return at most 3 open loops.",
          "Use status waiting only when progress depends on another person, reply, approval, delivery, information, or outside event. Otherwise use open.",
          "Priority high means the user stated urgency, a deadline, money/customer risk, or a near-term consequence. Low means optional or distant. Otherwise medium.",
          "linkedView must be one of: tasks, projects, quotes, notes, email, chat.",
          "If an unfinished item has an explicit or clearly relative deadline, return dueDate as YYYY-MM-DD. Use the supplied local date to resolve words such as today and tomorrow. Otherwise omit dueDate.",
          "You are also given current unresolved conversation loops. If the new user message clearly says one of those items was completed, canceled, received, answered, or is no longer needed, put that loop's exact id in resolveLoopIds.",
          "Do not resolve a loop from ambiguity, optimism, or a merely related statement.",
          "Return strict JSON only in this exact shape: {\"openLoops\":[{\"title\":\"...\",\"summary\":\"...\",\"status\":\"open|waiting\",\"priority\":\"low|medium|high\",\"waitingOn\":\"...\",\"nextAction\":\"...\",\"linkedView\":\"tasks|projects|quotes|notes|email|chat\",\"dueDate\":\"YYYY-MM-DD\"}],\"resolveLoopIds\":[\"existing-loop-id\"]}",
          "Keep titles under 80 characters and summaries under 180 characters.",
    ].join("\n");
    const input = [
      {
        role: "user",
        content: JSON.stringify({
          currentLocalDate: localDate || undefined,
          timeZone: timeZone || undefined,
          message,
          activeLoops,
        }),
      },
    ];

    let response: Response | null = null;

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
            model: gatewayModel,
            instructions,
            input,
            max_output_tokens: 450,
          }),
        });
      }
    } catch (error) {
      console.warn("Life Radar AI Gateway request could not start:", error);
    }

    if (response && !response.ok) {
      const detail = await response.text();
      console.error(
        "Life Radar AI Gateway error:",
        response.status,
        detail.slice(0, 500)
      );
      response = null;
    }

    if (!response) {
      const openAIKey = process.env.OPENAI_API_KEY?.trim();

      if (openAIKey) {
        response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + openAIKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: directModel,
            instructions,
            input,
            max_output_tokens: 450,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error(
            "Life Radar direct OpenAI error:",
            response.status,
            detail.slice(0, 500)
          );
        }
      }
    }

    if (!response || !response.ok) {
      return NextResponse.json({ openLoops: [] });
    }

    const result = (await response.json()) as ResponsesApiResult;
    const raw = extractOutputText(result);
    const parsed = parseRadarJson(raw);

    return NextResponse.json({
      openLoops: sanitizeLoops(parsed?.openLoops),
      resolveLoopIds: sanitizeResolveIds(parsed?.resolveLoopIds, activeLoops),
    });
  } catch (error) {
    console.error("Life Radar route error:", error);
    return NextResponse.json({ openLoops: [] });
  }
}

function extractOutputText(result: ResponsesApiResult): string {
  if (typeof result.output_text === "string" && result.output_text.trim()) {
    return result.output_text.trim();
  }

  return (
    result.output
      ?.flatMap((item) => item.content || [])
      .filter(
        (item) =>
          item.type === "output_text" && typeof item.text === "string"
      )
      .map((item) => item.text!.trim())
      .filter(Boolean)
      .join("\n") || ""
  );
}

function parseRadarJson(raw: string): any {
  if (!raw) return null;

  const cleaned = raw
    .replace(/^\`\`\`json\s*/i, "")
    .replace(/^\`\`\`\s*/i, "")
    .replace(/\s*\`\`\`$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end <= start) return null;

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function sanitizeLoops(value: unknown): RadarLoop[] {
  if (!Array.isArray(value)) return [];

  const allowedViews = new Set([
    "tasks",
    "projects",
    "quotes",
    "notes",
    "email",
    "chat",
  ]);

  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => {
      const title =
        typeof item.title === "string" ? item.title.trim().slice(0, 80) : "";

      if (!title) return null;

      const status = item.status === "waiting" ? "waiting" : "open";
      const priority =
        item.priority === "high" || item.priority === "low"
          ? item.priority
          : "medium";

      const linkedView =
        typeof item.linkedView === "string" && allowedViews.has(item.linkedView)
          ? item.linkedView
          : "tasks";

      return {
        title,
        summary:
          typeof item.summary === "string"
            ? item.summary.trim().slice(0, 180)
            : undefined,
        status,
        priority,
        waitingOn:
          typeof item.waitingOn === "string"
            ? item.waitingOn.trim().slice(0, 100)
            : undefined,
        nextAction:
          typeof item.nextAction === "string"
            ? item.nextAction.trim().slice(0, 160)
            : undefined,
        linkedView,
        dueDate:
          typeof item.dueDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate.trim())
            ? item.dueDate.trim()
            : undefined,
      } as RadarLoop;
    })
    .filter((item): item is RadarLoop => Boolean(item))
    .slice(0, 3);
}


function sanitizeResolveIds(
  value: unknown,
  activeLoops: Array<{ id: string }>
): string[] {
  if (!Array.isArray(value) || !activeLoops.length) return [];

  const allowed = new Set(activeLoops.map((loop) => loop.id));
  return value
    .filter((id): id is string => typeof id === "string" && allowed.has(id))
    .slice(0, 10);
}

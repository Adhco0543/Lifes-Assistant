// Tool registry: what Bella can do, how each tool is described to the model, and
// how its arguments are cleaned before anything touches the workspace.
//
// Every tool declares an ActionClass so the autonomy policy can decide whether it
// runs, waits for approval, or is blocked. Add new tools here; the executor and the
// chat route pick them up automatically.

import type { ActionClass } from './policy';

export type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  actionClass: ActionClass;
  /** Category used by requiresApprovalForTasks / autoTaskTypes in autonomy settings. */
  taskType?: string;
  parameters: JsonSchema;
  /** Human label for receipts, e.g. "Task created". */
  receiptLabel: string;
}

const str = (description: string, maxLength = 500) => ({ type: 'string', description, maxLength });
const optStr = (description: string, maxLength = 500) => ({ type: ['string', 'null'], description, maxLength });
const optNum = (description: string) => ({ type: ['number', 'null'], description });

function schema(properties: Record<string, unknown>): JsonSchema {
  // Strict mode requires every property to be listed in `required`; optional
  // values are expressed as nullable types instead.
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

export const TOOLS: ToolDefinition[] = [
  // ---- Reads ---------------------------------------------------------------
  {
    name: 'list_open_items',
    actionClass: 'read',
    receiptLabel: 'Looked up open items',
    description:
      'List the user\'s open tasks and active Life Radar items (things that need attention). Call this before completing, snoozing, or resolving anything so you have real ids. Returns at most 25 of each.',
    parameters: schema({
      include: {
        type: 'array',
        description: 'Which lists to return. Default both.',
        items: { type: 'string', enum: ['tasks', 'radar'] },
      },
    }),
  },
  {
    name: 'find_records',
    actionClass: 'read',
    receiptLabel: 'Searched the workspace',
    description:
      'Search saved workspace records by kind and a short text query. Use it to check whether a person, project, note, or quote already exists before creating a duplicate.',
    parameters: schema({
      kind: { type: 'string', enum: ['task', 'note', 'person', 'project', 'quote', 'memory', 'any'], description: 'Record kind to search.' },
      query: str('Words to match against titles, names, and text. Case-insensitive.', 120),
    }),
  },

  // ---- Workspace writes ----------------------------------------------------
  {
    name: 'create_task',
    actionClass: 'workspace',
    receiptLabel: 'Task created',
    description: 'Create a task in the user\'s Tasks list. Use the user\'s wording for the title. Only set dueDate when the user gave or clearly implied one.',
    parameters: schema({
      title: str('Short task title, imperative form, e.g. "Call Allen about the porch quote".', 160),
      dueDate: optStr('Due date as YYYY-MM-DD, or null.', 10),
      priority: { type: ['string', 'null'], enum: ['low', 'medium', 'high', null], description: 'Priority if the user indicated urgency; otherwise null.' },
      projectName: optStr('Existing project name this belongs to, or null.', 120),
      notes: optStr('Any extra detail the user gave, or null.', 1000),
    }),
  },
  {
    name: 'complete_task',
    actionClass: 'workspace',
    receiptLabel: 'Task completed',
    description: 'Mark an existing task done. Requires a real taskId from list_open_items.',
    parameters: schema({ taskId: str('Task id from list_open_items.', 80) }),
  },
  {
    name: 'save_memory',
    actionClass: 'workspace',
    receiptLabel: 'Memory saved',
    description:
      'Save a durable fact or preference the user wants remembered (e.g. "Allen prefers labor and materials broken out"). Only use for things the user stated or explicitly asked you to remember. Never store anything the user asked you not to remember.',
    parameters: schema({
      text: str('The memory, in one or two plain sentences.', 600),
      category: { type: 'string', enum: ['general', 'preference', 'work', 'routine', 'goal', 'personal'], description: 'Best-fit category.' },
    }),
  },
  {
    name: 'save_person',
    actionClass: 'workspace',
    receiptLabel: 'Person saved',
    description: 'Add a person to the People list (client, family, crew, vendor). Check find_records first to avoid duplicates.',
    parameters: schema({
      name: str('Full name as the user said it.', 120),
      relationship: optStr('Relationship or role, e.g. "client", "son", "electrician", or null.', 80),
      notes: optStr('Useful context about this person, or null.', 600),
    }),
  },
  {
    name: 'save_note',
    actionClass: 'workspace',
    receiptLabel: 'Note saved',
    description: 'Save a note in Notes. Good for site details, measurements, or anything the user dictates.',
    parameters: schema({
      title: optStr('Short title, or null to derive one from the text.', 120),
      text: str('Note body.', 5000),
    }),
  },
  {
    name: 'create_project',
    actionClass: 'workspace',
    receiptLabel: 'Project created',
    description: 'Create a project (a job or an effort with several steps). Check find_records first.',
    parameters: schema({
      name: str('Project name, e.g. "Hendershot porch".', 120),
      goal: optStr('One-line goal or scope, or null.', 400),
      nextStep: optStr('The immediate next step, or null.', 200),
    }),
  },
  {
    name: 'snooze_radar_item',
    actionClass: 'workspace',
    receiptLabel: 'Radar item snoozed',
    description: 'Snooze a Life Radar item for a number of days. Requires an openLoopId from list_open_items.',
    parameters: schema({
      openLoopId: str('Radar item id.', 80),
      days: { type: 'integer', minimum: 1, maximum: 30, description: 'Days to snooze (1–30).' },
    }),
  },
  {
    name: 'resolve_radar_item',
    actionClass: 'workspace',
    receiptLabel: 'Radar item resolved',
    description: 'Mark a Life Radar item handled. Requires an openLoopId from list_open_items.',
    parameters: schema({ openLoopId: str('Radar item id.', 80) }),
  },

  // ---- Drafts ----------------------------------------------------------------
  {
    name: 'draft_email',
    actionClass: 'draft',
    taskType: 'email',
    receiptLabel: 'Email drafted',
    description:
      'Write an email draft into Email drafts for the user to review. Does NOT send. Use plain, specific language. Never invent prices, dates, or commitments the user did not state.',
    parameters: schema({
      to: optStr('Recipient email address or name if known, or null.', 200),
      subject: str('Subject line.', 160),
      body: str('Email body in plain text.', 6000),
      category: { type: 'string', enum: ['customer', 'followup', 'invoice', 'personal', 'other'], description: 'Best-fit category.' },
    }),
  },
  {
    name: 'draft_quote',
    actionClass: 'draft',
    taskType: 'quote',
    receiptLabel: 'Quote drafted',
    description:
      'Create a quote draft in the Quote builder from numbers the user provided. Keep every amount exactly as given. Never invent prices, taxes, discounts, or terms. Does NOT send.',
    parameters: schema({
      clientName: str('Client name.', 120),
      projectDescription: str('What the work is.', 1000),
      items: {
        type: 'array',
        description: 'Line items exactly as the user stated them.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['description', 'price', 'quantity'],
          properties: {
            description: str('Line item description.', 200),
            price: { type: 'number', minimum: 0, description: 'Unit price in dollars.' },
            quantity: { type: 'number', minimum: 0, description: 'Quantity. Use 1 for lump sums.' },
          },
        },
      },
      notes: optStr('Terms or notes the user stated, or null.', 1000),
    }),
  },

  // ---- External ----------------------------------------------------------------
  {
    name: 'send_email',
    actionClass: 'external',
    taskType: 'email',
    receiptLabel: 'Email sent',
    description:
      'Send an email on the user\'s behalf. Only call this when the user explicitly asked to SEND (not draft) and you have a real recipient address. The user\'s autonomy settings decide whether it sends immediately or waits for their approval; either way, tell the user what happened based on the result.',
    parameters: schema({
      to: str('Recipient email address.', 200),
      subject: str('Subject line.', 160),
      body: str('Email body in plain text.', 6000),
      category: { type: 'string', enum: ['customer', 'followup', 'invoice', 'personal', 'other'], description: 'Best-fit category.' },
      amount: optNum('Dollar amount referenced in the email (quote total, invoice), or null.'),
    }),
  },
];

export const TOOL_INDEX: Record<string, ToolDefinition> = Object.fromEntries(TOOLS.map((tool) => [tool.name, tool]));

/** Shape expected by the OpenAI Responses API `tools` array. */
export function toolsForResponsesApi(): Array<Record<string, unknown>> {
  return TOOLS.map((tool) => ({
    type: 'function',
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
}

// ---- Argument cleaning --------------------------------------------------------

const cleanText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const cleanBlock = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\r\n/g, '\n').trim().slice(0, max) : '';
const cleanOptional = (value: unknown, max: number): string | null => {
  const text = cleanText(value, max);
  return text ? text : null;
};
const cleanEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const cleanNumber = (value: unknown): number | null => {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type CleanArgs = Record<string, unknown>;

/** Returns cleaned args or a user-facing error string. */
export function cleanToolArgs(name: string, raw: unknown): { ok: true; args: CleanArgs } | { ok: false; error: string } {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const fail = (error: string) => ({ ok: false as const, error });

  switch (name) {
    case 'list_open_items': {
      const include = Array.isArray(input.include) ? input.include.filter((item) => item === 'tasks' || item === 'radar') : [];
      return { ok: true, args: { include: include.length ? include : ['tasks', 'radar'] } };
    }
    case 'find_records': {
      const query = cleanText(input.query, 120);
      if (!query) return fail('Search needs a query.');
      return { ok: true, args: { kind: cleanEnum(input.kind, ['task', 'note', 'person', 'project', 'quote', 'memory', 'any'] as const, 'any'), query } };
    }
    case 'create_task': {
      const title = cleanText(input.title, 160);
      if (!title) return fail('A task needs a title.');
      const dueDate = cleanOptional(input.dueDate, 10);
      return {
        ok: true,
        args: {
          title,
          dueDate: dueDate && DATE_PATTERN.test(dueDate) ? dueDate : null,
          priority: input.priority === null ? null : cleanEnum(input.priority, ['low', 'medium', 'high'] as const, 'medium'),
          projectName: cleanOptional(input.projectName, 120),
          notes: cleanOptional(input.notes, 1000),
        },
      };
    }
    case 'complete_task': {
      const taskId = cleanText(input.taskId, 80);
      if (!taskId) return fail('complete_task needs a taskId from list_open_items.');
      return { ok: true, args: { taskId } };
    }
    case 'save_memory': {
      const text = cleanText(input.text, 600);
      if (!text) return fail('A memory needs text.');
      return { ok: true, args: { text, category: cleanEnum(input.category, ['general', 'preference', 'work', 'routine', 'goal', 'personal'] as const, 'general') } };
    }
    case 'save_person': {
      const personName = cleanText(input.name, 120);
      if (!personName) return fail('A person needs a name.');
      return { ok: true, args: { name: personName, relationship: cleanOptional(input.relationship, 80), notes: cleanOptional(input.notes, 600) } };
    }
    case 'save_note': {
      const text = cleanBlock(input.text, 5000);
      if (!text) return fail('A note needs text.');
      return { ok: true, args: { title: cleanOptional(input.title, 120) || text.split('\n')[0].slice(0, 80), text } };
    }
    case 'create_project': {
      const projectName = cleanText(input.name, 120);
      if (!projectName) return fail('A project needs a name.');
      return { ok: true, args: { name: projectName, goal: cleanOptional(input.goal, 400), nextStep: cleanOptional(input.nextStep, 200) } };
    }
    case 'snooze_radar_item': {
      const openLoopId = cleanText(input.openLoopId, 80);
      const days = Math.min(30, Math.max(1, Math.round(Number(input.days) || 1)));
      if (!openLoopId) return fail('snooze_radar_item needs an openLoopId from list_open_items.');
      return { ok: true, args: { openLoopId, days } };
    }
    case 'resolve_radar_item': {
      const openLoopId = cleanText(input.openLoopId, 80);
      if (!openLoopId) return fail('resolve_radar_item needs an openLoopId from list_open_items.');
      return { ok: true, args: { openLoopId } };
    }
    case 'draft_email': {
      const subject = cleanText(input.subject, 160);
      const body = cleanBlock(input.body, 6000);
      if (!subject || !body) return fail('An email draft needs a subject and a body.');
      return {
        ok: true,
        args: { to: cleanOptional(input.to, 200), subject, body, category: cleanEnum(input.category, ['customer', 'followup', 'invoice', 'personal', 'other'] as const, 'other') },
      };
    }
    case 'draft_quote': {
      const clientName = cleanText(input.clientName, 120);
      const projectDescription = cleanBlock(input.projectDescription, 1000);
      const items = (Array.isArray(input.items) ? input.items : [])
        .map((item) => {
          const record = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return { description: cleanText(record.description, 200), price: cleanNumber(record.price), quantity: cleanNumber(record.quantity) ?? 1 };
        })
        .filter((item): item is { description: string; price: number; quantity: number } => Boolean(item.description) && item.price !== null && item.price >= 0 && item.quantity >= 0)
        .slice(0, 50);
      if (!clientName) return fail('A quote needs a client name.');
      if (!items.length) return fail('A quote needs at least one line item with a price the user provided.');
      const total = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
      return { ok: true, args: { clientName, projectDescription, items, notes: cleanOptional(input.notes, 1000), total } };
    }
    case 'send_email': {
      const to = cleanText(input.to, 200);
      const subject = cleanText(input.subject, 160);
      const body = cleanBlock(input.body, 6000);
      if (!EMAIL_PATTERN.test(to)) return fail('send_email needs a valid recipient email address. Ask the user for it or use draft_email instead.');
      if (!subject || !body) return fail('An email needs a subject and a body.');
      return {
        ok: true,
        args: { to, subject, body, category: cleanEnum(input.category, ['customer', 'followup', 'invoice', 'personal', 'other'] as const, 'other'), amount: cleanNumber(input.amount) },
      };
    }
    default:
      return fail('Unknown tool: ' + name);
  }
}

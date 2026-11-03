// Tool executor: runs one tool call for one signed-in user.
//
// Flow for every call:
//   1. clean arguments              (registry.cleanToolArgs)
//   2. ask the autonomy policy      (policy.decide)
//   3. execute, or stop             (Firestore REST with the user's own token)
//   4. write a receipt              (users/{uid}/events, same place the UI writes)
//   5. return a result for the model and a receipt for the client UI
//
// Reads write no receipt. Everything else does, including blocked and
// approval-required outcomes, so "if the assistant did it, there is a record"
// holds for things she tried to do as well.

import { deliverEmail } from '../emailDelivery';
import { FirestoreRestClient, type FirestoreDocument, type FirestoreValue } from './firestoreRest';
import { decide, localMinutesFor, type PolicyResult, type PolicySettings } from './policy';
import { cleanToolArgs, TOOL_INDEX, type CleanArgs } from './registry';

export interface ToolCallRequest {
  callId: string;
  name: string;
  arguments: unknown;
}

/** What the client renders under Bella's reply. Also what gets stored in the receipt. */
export interface ActionReceipt {
  callId: string;
  tool: string;
  label: string;
  summary: string;
  status: 'done' | 'approval_required' | 'blocked' | 'failed';
  reason: string;
  policyCode: PolicyResult['code'] | 'invalid_args' | 'execution_error';
  /** Ids created or touched, so the UI can deep-link. */
  recordId?: string | null;
  linkedView?: string | null;
  /** For approval_required actions: everything needed to carry it out on approval. */
  pendingAction?: { tool: string; args: CleanArgs } | null;
  at: number;
}

export interface ToolExecutionResult {
  /** JSON string handed back to the model as the function_call_output. */
  modelOutput: string;
  receipt: ActionReceipt | null;
}

export interface ExecutorContext {
  uid: string;
  idToken: string;
  projectId: string;
  timeZone?: string;
  conversationId?: string;
  background?: boolean;
  now?: () => number;
  fetchImpl?: typeof fetch;
}

type Store = FirestoreRestClient;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(now: number, timeZone: string | undefined): number {
  const minutes = localMinutesFor(new Date(now), timeZone);
  return now - minutes * 60_000;
}

async function loadAutonomySettings(store: Store, uid: string): Promise<PolicySettings> {
  try {
    const document = await store.getDocument('users/' + uid + '/settings/autonomy');
    return (document?.data || {}) as PolicySettings;
  } catch (error) {
    console.warn('Autonomy settings unavailable; using safe defaults:', error);
    return {};
  }
}

async function countExecutedToday(store: Store, uid: string, now: number, timeZone: string | undefined): Promise<number> {
  try {
    const documents = await store.query({
      parentPath: 'users/' + uid,
      collectionId: 'events',
      filters: [{ field: 'createdAt', op: 'GREATER_THAN_OR_EQUAL', value: startOfLocalDay(now, timeZone) }],
      limit: 200,
    });
    return documents.filter((document) => {
      const data = (document.data.data || {}) as Record<string, FirestoreValue>;
      return data.actor === 'assistant' && data.status === 'done';
    }).length;
  } catch (error) {
    console.warn('Could not count today\'s actions; assuming none:', error);
    return 0;
  }
}

function text(value: FirestoreValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);
}

function recordData(document: FirestoreDocument): Record<string, FirestoreValue> {
  const data = document.data.data;
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, FirestoreValue>) : {};
}

// ---- Individual tool implementations -------------------------------------------

interface ExecOutcome {
  summary: string;
  result: Record<string, unknown>;
  recordId?: string | null;
  linkedView?: string | null;
  eventName: string;
  eventData?: Record<string, unknown>;
}

async function listOpenItems(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const include = args.include as string[];
  const result: Record<string, unknown> = {};
  if (include.includes('tasks')) {
    const documents = await store.query({
      parentPath: 'users/' + uid,
      collectionId: 'records',
      filters: [{ field: 'kind', op: 'EQUAL', value: 'task' }],
      orderBy: { field: 'updatedAt', direction: 'DESCENDING' },
      limit: 100,
    });
    result.tasks = documents
      .filter((document) => text(recordData(document).status, 'open') !== 'done')
      .slice(0, 25)
      .map((document) => {
        const data = recordData(document);
        return { taskId: document.id, title: text(data.title), dueDate: text(data.dueDate) || null, priority: text(data.priority) || null, projectName: text(data.projectName) || null };
      });
  }
  if (include.includes('radar')) {
    const documents = await store.query({
      parentPath: 'users/' + uid,
      collectionId: 'openLoops',
      filters: [{ field: 'status', op: 'EQUAL', value: 'open' }],
      limit: 100,
    });
    result.radar = documents
      .filter((document) => !document.data.archived)
      .slice(0, 25)
      .map((document) => ({
        openLoopId: document.id,
        title: text(document.data.title),
        nextAction: text(document.data.nextAction) || null,
        priority: text(document.data.priority) || null,
        waitingOn: text(document.data.waitingOn) || null,
        dueAt: typeof document.data.dueAt === 'number' ? new Date(document.data.dueAt).toISOString().slice(0, 10) : null,
      }));
  }
  const taskCount = Array.isArray(result.tasks) ? result.tasks.length : 0;
  const radarCount = Array.isArray(result.radar) ? result.radar.length : 0;
  return { summary: taskCount + ' open tasks, ' + radarCount + ' radar items', result: { ...result, asOf: new Date(now).toISOString() }, eventName: 'none' };
}

async function findRecords(store: Store, uid: string, args: CleanArgs): Promise<ExecOutcome> {
  const kind = args.kind as string;
  const needle = String(args.query).toLowerCase();
  const documents = await store.query({
    parentPath: 'users/' + uid,
    collectionId: 'records',
    filters: kind === 'any' ? [] : [{ field: 'kind', op: 'EQUAL', value: kind }],
    orderBy: { field: 'updatedAt', direction: 'DESCENDING' },
    limit: 150,
  });
  const matches = documents
    .map((document) => {
      const data = recordData(document);
      const haystack = [data.title, data.name, data.text, data.clientName, data.relationship, data.goal, data.projectDescription]
        .map((value) => text(value))
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle)
        ? {
            recordId: document.id,
            kind: text(document.data.kind),
            title: text(data.title || data.name || data.clientName).slice(0, 120),
            preview: text(data.text || data.goal || data.notes || data.projectDescription).slice(0, 200) || null,
            status: text(data.status) || null,
          }
        : null;
    })
    .filter(Boolean)
    .slice(0, 15);
  return { summary: matches.length + ' match(es) for "' + args.query + '"', result: { matches }, eventName: 'none' };
}

async function createTask(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  let projectId: string | null = null;
  const projectName = (args.projectName as string | null) || null;
  if (projectName) {
    const projects = await store.query({ parentPath: 'users/' + uid, collectionId: 'records', filters: [{ field: 'kind', op: 'EQUAL', value: 'project' }], limit: 100 });
    const match = projects.find((document) => text(recordData(document).name).toLowerCase() === projectName.toLowerCase());
    projectId = match?.id || null;
  }
  const data = {
    title: args.title,
    status: 'open',
    dueDate: args.dueDate || '',
    priority: args.priority || 'medium',
    projectId,
    projectName: projectId ? projectName : projectName || null,
    notes: args.notes || '',
    createdBy: 'assistant',
  };
  const recordId = await store.createDocument('users/' + uid + '/records', { kind: 'task', data, createdAt: now, updatedAt: now });
  return {
    summary: String(args.title) + (args.dueDate ? ' · due ' + args.dueDate : ''),
    result: { taskId: recordId, title: args.title, dueDate: args.dueDate, priority: data.priority, projectName: data.projectName },
    recordId,
    linkedView: 'tasks',
    eventName: 'task.created',
    eventData: { title: args.title, recordId, dueDate: args.dueDate, priority: data.priority, projectId, projectName: data.projectName },
  };
}

async function completeTask(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const taskId = String(args.taskId);
  const document = await store.getDocument('users/' + uid + '/records/' + taskId);
  if (!document || text(document.data.kind) !== 'task') throw new Error('No task with id ' + taskId + '. Call list_open_items to get a current id.');
  const data = recordData(document);
  await store.patchDocument('users/' + uid + '/records/' + taskId, { data: { ...data, status: 'done', completedAt: now }, updatedAt: now });
  return {
    summary: text(data.title, 'Task'),
    result: { taskId, title: text(data.title), status: 'done' },
    recordId: taskId,
    linkedView: 'tasks',
    eventName: 'task.completed',
    eventData: { title: text(data.title), recordId: taskId },
  };
}

async function saveMemory(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const data = { text: args.text, category: args.category, createdBy: 'assistant' };
  const recordId = await store.createDocument('users/' + uid + '/records', { kind: 'memory', data, createdAt: now, updatedAt: now });
  const preview = String(args.text).slice(0, 80);
  return {
    summary: preview,
    result: { memoryId: recordId, text: args.text, category: args.category },
    recordId,
    linkedView: 'memory',
    eventName: 'memory.saved',
    eventData: { recordId, category: args.category, preview },
  };
}

async function savePerson(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const data = { name: args.name, relationship: args.relationship || '', notes: args.notes || '', createdBy: 'assistant' };
  const recordId = await store.createDocument('users/' + uid + '/records', { kind: 'person', data, createdAt: now, updatedAt: now });
  return {
    summary: String(args.name) + (args.relationship ? ' · ' + args.relationship : ''),
    result: { personId: recordId, ...data },
    recordId,
    linkedView: 'people',
    eventName: 'person.saved',
    eventData: { recordId, name: args.name, relationship: args.relationship || '' },
  };
}

async function saveNote(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const data = { title: args.title, text: args.text, createdBy: 'assistant' };
  const recordId = await store.createDocument('users/' + uid + '/records', { kind: 'note', data, createdAt: now, updatedAt: now });
  const preview = String(args.text).slice(0, 80);
  return {
    summary: String(args.title),
    result: { noteId: recordId, title: args.title },
    recordId,
    linkedView: 'notes',
    eventName: 'note.saved',
    eventData: { recordId, preview },
  };
}

async function createProject(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const data = { name: args.name, goal: args.goal || '', nextStep: args.nextStep || '', status: 'active', createdBy: 'assistant' };
  const recordId = await store.createDocument('users/' + uid + '/records', { kind: 'project', data, createdAt: now, updatedAt: now });
  return {
    summary: String(args.name),
    result: { projectId: recordId, ...data },
    recordId,
    linkedView: 'projects',
    eventName: 'project.saved',
    eventData: { recordId, name: args.name, status: 'active' },
  };
}

async function updateRadar(store: Store, uid: string, args: CleanArgs, now: number, mode: 'snooze' | 'resolve'): Promise<ExecOutcome> {
  const openLoopId = String(args.openLoopId);
  const document = await store.getDocument('users/' + uid + '/openLoops/' + openLoopId);
  if (!document) throw new Error('No radar item with id ' + openLoopId + '. Call list_open_items to get a current id.');
  const title = text(document.data.title, 'Radar item');
  if (mode === 'snooze') {
    const until = now + Number(args.days) * DAY_MS;
    await store.patchDocument('users/' + uid + '/openLoops/' + openLoopId, { status: 'snoozed', snoozedUntil: until, updatedAt: now });
    return {
      summary: title + ' · ' + args.days + ' day' + (Number(args.days) === 1 ? '' : 's'),
      result: { openLoopId, title, status: 'snoozed', snoozedUntil: new Date(until).toISOString().slice(0, 10) },
      recordId: openLoopId,
      linkedView: 'radar',
      eventName: 'life_radar.snoozed',
      eventData: { openLoopId, title, days: args.days },
    };
  }
  await store.patchDocument('users/' + uid + '/openLoops/' + openLoopId, { status: 'resolved', snoozedUntil: null, updatedAt: now });
  return {
    summary: title,
    result: { openLoopId, title, status: 'resolved' },
    recordId: openLoopId,
    linkedView: 'radar',
    eventName: 'life_radar.resolved',
    eventData: { openLoopId, title },
  };
}

async function draftEmail(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const draft = { to: args.to || '', subject: args.subject, body: args.body, category: args.category, source: 'assistant', updatedAt: now };
  await store.patchDocument('users/' + uid + '/drafts/work-email', { kind: 'work-email', data: draft, updatedAt: now });
  return {
    summary: String(args.subject) + (args.to ? ' → ' + args.to : ''),
    result: { saved: true, where: 'Email drafts', to: args.to, subject: args.subject, sent: false },
    linkedView: 'email',
    eventName: 'email.drafted',
    eventData: { to: args.to || '', subject: args.subject, category: args.category },
  };
}

async function draftQuote(store: Store, uid: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  const items = args.items as Array<{ description: string; price: number; quantity: number }>;
  const draft = {
    clientName: args.clientName,
    projectDescription: args.projectDescription,
    items: items.map((item) => ({ description: item.description, price: item.price, quantity: item.quantity })),
    notes: args.notes || '',
    total: args.total,
    source: 'assistant',
    updatedAt: now,
  };
  await store.patchDocument('users/' + uid + '/drafts/work-quote', { kind: 'work-quote', data: draft, updatedAt: now });
  return {
    summary: String(args.clientName) + ' · $' + Number(args.total).toFixed(2),
    result: { saved: true, where: 'Quote builder', clientName: args.clientName, total: args.total, lineItems: items.length, sent: false },
    linkedView: 'quotes',
    eventName: 'quote.drafted',
    eventData: { clientName: args.clientName, total: args.total, lineItems: items.length },
  };
}

async function sendEmail(args: CleanArgs): Promise<ExecOutcome> {
  const delivery = await deliverEmail({ to: String(args.to), subject: String(args.subject), text: String(args.body) });
  if (!delivery.ok) throw new Error(delivery.error);
  return {
    summary: String(args.subject) + ' → ' + args.to,
    result: { sent: true, to: args.to, subject: args.subject, providerId: delivery.id },
    linkedView: 'email',
    eventName: 'email.sent',
    eventData: { to: args.to, subject: args.subject, providerId: delivery.id, category: args.category, amount: args.amount },
  };
}

async function runTool(store: Store, uid: string, name: string, args: CleanArgs, now: number): Promise<ExecOutcome> {
  switch (name) {
    case 'list_open_items': return listOpenItems(store, uid, args, now);
    case 'find_records': return findRecords(store, uid, args);
    case 'create_task': return createTask(store, uid, args, now);
    case 'complete_task': return completeTask(store, uid, args, now);
    case 'save_memory': return saveMemory(store, uid, args, now);
    case 'save_person': return savePerson(store, uid, args, now);
    case 'save_note': return saveNote(store, uid, args, now);
    case 'create_project': return createProject(store, uid, args, now);
    case 'snooze_radar_item': return updateRadar(store, uid, args, now, 'snooze');
    case 'resolve_radar_item': return updateRadar(store, uid, args, now, 'resolve');
    case 'draft_email': return draftEmail(store, uid, args, now);
    case 'draft_quote': return draftQuote(store, uid, args, now);
    case 'send_email': return sendEmail(args);
    default: throw new Error('Unknown tool: ' + name);
  }
}

// ---- Receipts ----------------------------------------------------------------

async function writeReceipt(store: Store, uid: string, receipt: ActionReceipt, eventName: string, extra: Record<string, unknown>, conversationId: string | undefined): Promise<void> {
  try {
    await store.createDocument('users/' + uid + '/events', {
      eventName,
      data: {
        ...extra,
        actor: 'assistant',
        tool: receipt.tool,
        status: receipt.status,
        reason: receipt.reason,
        policyCode: receipt.policyCode,
        summary: receipt.summary,
        conversationId: conversationId || null,
      },
      createdAt: receipt.at,
    });
  } catch (error) {
    console.warn('Receipt write failed:', error);
  }
}

// ---- Entry point --------------------------------------------------------------

export class ToolExecutor {
  private readonly store: Store;
  private readonly context: ExecutorContext;
  private settings: PolicySettings | null = null;
  private executedToday: number | null = null;

  constructor(context: ExecutorContext) {
    this.context = context;
    this.store = new FirestoreRestClient({ projectId: context.projectId, idToken: context.idToken, fetchImpl: context.fetchImpl });
  }

  private now(): number {
    return this.context.now ? this.context.now() : Date.now();
  }

  private async prepare(): Promise<{ settings: PolicySettings; executedToday: number }> {
    if (this.settings === null) this.settings = await loadAutonomySettings(this.store, this.context.uid);
    if (this.executedToday === null) this.executedToday = await countExecutedToday(this.store, this.context.uid, this.now(), this.context.timeZone);
    return { settings: this.settings, executedToday: this.executedToday };
  }

  async execute(call: ToolCallRequest): Promise<ToolExecutionResult> {
    const { uid, conversationId, timeZone } = this.context;
    const definition = TOOL_INDEX[call.name];
    const at = this.now();
    const base = { callId: call.callId, tool: call.name, label: definition?.receiptLabel || call.name, at } as const;

    if (!definition) {
      return { modelOutput: JSON.stringify({ error: 'Unknown tool ' + call.name }), receipt: null };
    }

    const cleaned = cleanToolArgs(call.name, call.arguments);
    if (!cleaned.ok) {
      return {
        modelOutput: JSON.stringify({ error: cleaned.error }),
        receipt: { ...base, summary: cleaned.error, status: 'failed', reason: cleaned.error, policyCode: 'invalid_args' },
      };
    }
    const args = cleaned.args;

    const { settings, executedToday } = await this.prepare();
    const policy = decide(settings, {
      actionClass: definition.actionClass,
      taskType: definition.taskType,
      emailCategory: typeof args.category === 'string' ? args.category : undefined,
      amount: typeof args.amount === 'number' ? args.amount : typeof args.total === 'number' ? args.total : undefined,
      recipient: typeof args.to === 'string' ? args.to : undefined,
      executedToday,
      localMinutes: localMinutesFor(new Date(at), timeZone),
      background: this.context.background,
    });

    if (policy.decision !== 'allow') {
      const status = policy.decision === 'blocked' ? 'blocked' : 'approval_required';
      const summary = call.name === 'send_email' ? String(args.subject) + ' → ' + args.to : definition.receiptLabel;
      const receipt: ActionReceipt = {
        ...base,
        summary,
        status,
        reason: policy.reason,
        policyCode: policy.code,
        pendingAction: status === 'approval_required' ? { tool: call.name, args } : null,
        linkedView: call.name === 'send_email' ? 'email' : null,
      };
      // Approval-required emails are also parked in Email drafts so nothing is lost.
      if (status === 'approval_required' && call.name === 'send_email') {
        try { await draftEmail(this.store, uid, args, at); } catch (error) { console.warn('Could not park email draft:', error); }
      }
      await writeReceipt(this.store, uid, receipt, status === 'blocked' ? 'action.blocked' : 'action.approval_required', { args: redact(args) }, conversationId);
      return {
        modelOutput: JSON.stringify({
          executed: false,
          status,
          reason: policy.reason,
          instruction:
            status === 'blocked'
              ? 'Tell the user plainly that this was not done and why. Do not claim it happened.'
              : 'Tell the user this is ready and waiting for their approval in the card below your message. Do not claim it was sent or done.',
        }),
        receipt,
      };
    }

    try {
      const outcome = await runTool(this.store, uid, call.name, args, at);
      const receipt: ActionReceipt = {
        ...base,
        summary: outcome.summary,
        status: 'done',
        reason: policy.reason,
        policyCode: policy.code,
        recordId: outcome.recordId || null,
        linkedView: outcome.linkedView || null,
      };
      if (definition.actionClass !== 'read') {
        this.executedToday = (this.executedToday || 0) + 1;
        await writeReceipt(this.store, uid, receipt, outcome.eventName, outcome.eventData || {}, conversationId);
        return { modelOutput: JSON.stringify({ executed: true, ...outcome.result }), receipt };
      }
      return { modelOutput: JSON.stringify(outcome.result), receipt: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The action failed.';
      const receipt: ActionReceipt = { ...base, summary: message.slice(0, 160), status: 'failed', reason: message.slice(0, 200), policyCode: 'execution_error' };
      if (definition.actionClass !== 'read') await writeReceipt(this.store, uid, receipt, 'action.failed', { args: redact(args) }, conversationId);
      return { modelOutput: JSON.stringify({ executed: false, status: 'failed', error: message, instruction: 'Tell the user this did not go through. Do not claim it happened.' }), receipt };
    }
  }
}

/** Keeps receipts readable and small: long bodies are truncated. */
function redact(args: CleanArgs): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] = typeof value === 'string' && value.length > 240 ? value.slice(0, 240) + '…' : value;
  }
  return out;
}

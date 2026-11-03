# Tool layer: autonomy checks and action receipts

This document describes what is actually implemented in the codebase (as opposed to
`TOOL_EXECUTION_LAYER.md`, which is an older design note). The goal is simple:
Bella should be able to *do* things in the user's workspace, every action should
obey the user's Autonomy Settings, and every action should leave a record.

Two principles from the app's own copy drive the design:

- **Approval-first for external actions.** Anything that leaves the workspace
  (email today) asks first unless the user has explicitly turned on auto-send.
- **If the assistant did it, there should be a record.** Receipts are written for
  completed actions *and* for actions that were blocked, waited for approval, or failed.

## How a request flows

```
Chat UI ──POST /api/chat {enableTools:true, conversationId}──▶ route.ts
   │                                                             │
   │                    OpenAI Responses API (tools attached)    │
   │                    ◀── function_call items ─────────────────┤
   │                                                             ▼
   │                                                      ToolExecutor
   │                                                   ┌─────────┴─────────┐
   │                                              policy.decide()     Firestore REST
   │                                             (AutonomySettings)   (user's ID token)
   │                                                   └─────────┬─────────┘
   │                    ◀── function_call_output + receipt ──────┤
   │  ◀── {message, actions:[receipt…]} ─────────────────────────┘
   ▼
ChatActionReceipts (cards under the reply; Approve / Don't send / Open view)
```

1. `components/AdvancedConversationalChat.tsx` sends `enableTools: true` and a
   `conversationId`. Other callers of `/api/chat` (quote builder, note editor,
   focus brief, email composer, system check) do not, so they stay text-only.
2. `app/api/chat/route.ts` verifies the Firebase ID token with
   `getFirebaseRequestUser`, attaches the tool definitions from
   `lib/tools/registry.ts`, and runs up to `MAX_TOOL_ROUNDS` (4) rounds of
   model → tool → model. The final round is forced to `tool_choice: 'none'` so
   the user always gets a reply.
3. Each `function_call` goes through `ToolExecutor.execute()` in
   `lib/tools/executor.ts`, which:
   - validates and cleans arguments (`cleanToolArgs`),
   - loads `users/{uid}/settings/autonomy` and asks `decide()` in
     `lib/tools/policy.ts` whether the action is `allow`, `approval_required`, or `blocked`,
   - performs the write through `lib/tools/firestoreRest.ts` using the **user's own
     ID token** (so Firestore security rules still apply; there is no admin SDK),
   - writes a receipt to `users/{uid}/events`.
4. The route returns the receipts as `actions` on the chat response
   (`parseChatActions` in `lib/chatApiContracts.ts`), and
   `components/ChatActionReceipts.tsx` renders them.

## Tools

| Tool | Class | What it does |
| --- | --- | --- |
| `list_open_items` | read | Open tasks + Life Radar items with real ids |
| `find_records` | read | Keyword search across tasks, notes, people, projects, memories |
| `create_task`, `complete_task` | workspace | `users/{uid}/records` kind `task` |
| `save_memory`, `save_person`, `save_note`, `create_project` | workspace | records of the matching kind |
| `snooze_radar_item`, `resolve_radar_item` | workspace | `users/{uid}/openLoops` |
| `draft_email` | draft | `users/{uid}/drafts/work-email` |
| `draft_quote` | draft | `users/{uid}/drafts/work-quote` |
| `send_email` | external (taskType `email`) | Resend via `lib/emailDelivery.ts` |

All schemas are strict (every property required, `additionalProperties: false`),
which is what the Responses API needs for reliable structured calls.

## Policy (`lib/tools/policy.ts`)

`decide(settings, context)` is a pure function, so it is easy to test and reason about.
Rules in order:

| Situation | Decision | `policyCode` |
| --- | --- | --- |
| Read-only tool | allow | `read_only` |
| `dailyExecutionLimit` reached (any write) | blocked | `daily_limit` |
| Workspace write | allow | `workspace_write` |
| Draft | allow | `draft_only` |
| External + quiet hours (`disableDuringHours`) | approval_required | `quiet_hours` |
| External + background run | approval_required | `background_draft_only` |
| External + task type in `requiresApprovalForTasks` | approval_required | `requires_approval_list` |
| External + amount > `autoSendQuotesUnder` when `requireConfirmationForLargeAmounts` | approval_required | `large_amount` |
| Email + `emailCategories[category]` or `emailBehavior: auto_send` | allow | `email_auto` |
| Email + trusted recipient (when enabled) | allow | `trusted_recipient` |
| Email + `emailBehavior: draft_only` | approval_required | `email_draft` |
| Email otherwise | approval_required | `email_ask` |
| Any other external action | approval_required | `unknown_external` |

The daily limit counts only events with `data.actor === 'assistant'` and
`data.status === 'done'` for today, plus whatever the executor has already done in
the current turn, so the user's own actions never eat into Bella's budget.

## Receipts

Receipts live in `users/{uid}/events` next to the user's own activity and are
shown in the Action Ledger with a "By the assistant" note and PENDING / NOT DONE
badges. Shape:

```ts
{
  eventName: 'task.created' | 'task.completed' | 'memory.saved' | 'person.saved' |
             'note.saved' | 'project.saved' | 'life_radar.snoozed' | 'life_radar.resolved' |
             'email.drafted' | 'quote.drafted' | 'email.sent' |
             'action.approval_required' | 'action.blocked' | 'action.failed',
  data: {
    actor: 'assistant',
    tool, status: 'done' | 'approval_required' | 'blocked' | 'failed',
    reason, policyCode, summary, conversationId, recordId?, linkedView?,
    args? // redacted copy for non-done actions
  },
  createdAt
}
```

When `send_email` needs approval, the executor also parks the message in
`drafts/work-email` so nothing is lost. The chat card offers **Approve and send**
(posts to `/api/email/send`, then logs `email.sent` with `approvedBy: 'user'`) and
**Don't send**.

## Environment

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Model access (existing) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Required for the Firestore REST client; tools are disabled without it |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_DOMAIN_VERIFIED` | Email delivery; `send_email` fails cleanly (with a receipt) if not configured |

## Testing

```
npm run typecheck
npm run lint
npm test            # Node 22+ (uses --experimental-strip-types)
```

- `tests/toolPolicy.test.mjs` – every policy branch, quiet-hour wraparound, background runs.
- `tests/toolRegistry.test.mjs` – schema strictness, argument cleaning, validation errors.
- `tests/toolExecutor.test.mjs` – runs the executor against a fake Firestore REST
  backend and a fake Resend endpoint; checks receipts, approval parking, daily limits,
  failure records.
- `tests/chatContracts.test.mjs` – `function_call` parsing and `actions` parsing.

Manual check: sign in, open Chat, say "add a task to call Allen about the porch
quote tomorrow" → a task appears with a receipt card; say "email the porch quote to
…" → with default settings you get an approval card, nothing is sent, and the
Action Ledger shows a PENDING entry.

## Known limitations / next steps

- No scheduled (cron) execution yet; `background` mode is wired in the policy but
  nothing triggers it.
- `draft_email` / `draft_quote` overwrite the single `drafts/work-email` /
  `drafts/work-quote` document, matching the existing composer behavior.
- The approve-and-send receipt is written client-side after `/api/email/send`
  succeeds; moving that server-side would make it tamper-proof.
- Calendar, SMS and job-search tools from the original design note are not implemented.

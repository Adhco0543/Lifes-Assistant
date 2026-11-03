# Life's Assistant

A personal and business assistant for people who work with their hands and their phone:
tasks, quotes, follow-ups, notes, people, projects, and a chat assistant (Bella by default)
that remembers context and can act inside your workspace with your permission.

Built with Next.js 15, React 19, Firebase Auth + Firestore, and the OpenAI Responses API.
Deployed on Vercel.

## Getting started

```bash
npm ci
# create .env.local with the variables below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Required | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | Firebase client SDK (auth, Firestore) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | yes | Chat, drafting, transcription |
| `NEXT_PUBLIC_APP_URL` | yes | OAuth callbacks and absolute links |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_DOMAIN_VERIFIED`, `RESEND_DOMAIN_ID` | for email | Sending email |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Gmail/Calendar | Google integration |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | for GitHub | Repository review |
| `INTEGRATION_TOKEN_SECRET`, `INTEGRATION_STATE_SECRET` | for integrations | Encrypting stored OAuth tokens and state |

Step-by-step setup guides live in [`docs/setup/`](docs/setup/).

### Scripts

```bash
npm run dev        # local dev server
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint . --quiet
npm test           # node:test suite (requires Node 22+)
npm run validate   # typecheck + lint + test
```

## Project layout

```
app/            Next.js app router: pages and /api routes
components/     UI (App.tsx is the shell; LifeAssistantHome, RadarCenter, AIQuoteBuilder, …)
lib/            Client/server logic (firebaseBackend, lifePreferences, workspaceRadar, …)
lib/tools/      Assistant tool layer: registry, policy, executor (see docs/TOOL_LAYER.md)
tests/          node:test suites
public/         Icons, manifest
docs/           Documentation (below)
```

## Documentation

- [`docs/setup/`](docs/setup/) – Firebase, Vercel, OpenAI, email setup.
- [`docs/reference/`](docs/reference/) – Architecture, API reference, features, developer and multi-user guides, roadmap.
- `docs/TOOL_LAYER.md` (added by the tool-layer PR) and `TOOL_EXECUTION_LAYER.md` – How the assistant acts: tools, autonomy policy, action receipts.
- [`docs/archive/`](docs/archive/) – Older status reports and design sketches. Historical only; do not treat as a description of current behavior.

## Principles

- **Approval-first for external actions.** Nothing leaves the workspace (email, etc.) without the user's settings allowing it.
- **If the assistant did it, there is a record.** Every assistant action shows up in the Action Ledger.
- **Honest numbers.** Quotes are built from the user's own line items; the AI polishes wording, it never invents prices.

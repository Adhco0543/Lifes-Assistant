# Scheduled Life Radar

Life Radar can run a daily server-side sweep in addition to the signed-in browser scan. The scheduled route uses the existing workspace detectors for overdue/due-soon tasks, stale quotes, abandoned drafts, and stalled active projects. It only updates that user's Radar records; it does not send email or perform external actions.

## Vercel and Firebase setup

The cron in `vercel.json` runs at `0 7 * * *` (07:00 UTC). Vercel Hobby supports daily schedules; cron execution may happen any time during the configured UTC hour. The route opts into Vercel's 300-second Hobby function-duration ceiling. Use a plan that supports more frequent schedules if daily is not sufficient. See [Vercel Cron Jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing) and [Vercel Functions limits](https://vercel.com/docs/functions/limitations).

Add these values as **server-side** Vercel environment variables for the deployments where scheduled Radar should run:

| Variable | Required | Notes |
| --- | --- | --- |
| `CRON_SECRET` | Yes | High-entropy secret used to authenticate cron requests. Vercel sends it in the `Authorization` header. Never expose it with a `NEXT_PUBLIC_` prefix. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes | JSON for a dedicated Google service account. Its `project_id` must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; its private key is used only by the Node.js cron route. |

Grant that service account only the Firestore permissions needed to list user documents and read/write the users' Radar, records, drafts, and autonomy settings. Do not grant project Owner/Editor access. Protect and rotate the key as a server secret. The credential can access multiple users' workspace data, so only configure it after reviewing the deployment's IAM controls.

The cron returns `401` when the request secret is absent or incorrect and `503` when required server configuration is unavailable. The route itself does not reveal configuration values. Do not log the authorization header, service account JSON, ID tokens, or workspace content.

## Run policy and scope

- Only users with a saved autonomy setting `backgroundMode: true` are scanned. The default is off.
- The sweep only refreshes workspace Radar records; it does not contact the user or run external actions. Quiet-hours rules continue to govern external actions through the existing autonomy policy. The saved timezone from assistant preferences or the profile (UTC fallback) is used for due-date calculations.
- The sweep uses the existing per-user Firestore paths and existing `workspaceRadar` rules. Deterministic IDs make newly created workspace-derived Radar items safe to retry.
- The sweep never sends communications or executes chat tools. Existing user-created and conversation-derived Radar items are not deleted by the scheduled route.
- This is a daily sweep, not an exact-time reminder system. Vercel cron timing is approximate within the scheduled hour.

## Manual acceptance checks

1. In a preview deployment, call `/api/cron/life-radar` without the configured authorization header; verify `401`.
2. With correct configuration and authorization, verify a response with aggregate `scanned`, `skipped`, and `failed` counts. Counts do not include user identifiers.
3. Use a test account with background mode off; verify it is skipped and its Radar is unchanged.
4. Enable background mode for a test account and create an overdue task; verify the item appears in Life Radar after a run.
5. Run the same sweep again; verify it does not create another copy. Repeat during configured quiet hours and verify Radar updates remain silent with no notification or external action.
6. Confirm no email or other external action is produced by a sweep, including during quiet hours.

Production configuration is intentionally not changed by this code change. A human with deployment and IAM access must configure and verify the secrets and service-account permissions before enabling the cron in production.

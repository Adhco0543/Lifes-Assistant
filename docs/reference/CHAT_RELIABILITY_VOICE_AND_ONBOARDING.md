# Onboarding, chat reliability, and voice capture

## First-run interview

New users see a guided, one-question-at-a-time interview for mode, priorities, capture preference, assistant focus, and answer style. Answers can be skipped, revisited, and reviewed/edited before the existing authenticated profile writer saves them. An unfinished interview is kept only in the current browser session. Completed profiles are not routed back through onboarding. The short optional focus answer and answer style are bounded and stored with the user's existing profile; the focus can be included in chat context.

The prompts are a fixed guided interview, not a generative AI conversation. This avoids collecting more information than the selected preferences and does not make onboarding depend on AI availability.

## Chat reliability changes

The chat submit handler now takes a synchronous in-flight lock before any asynchronous work. A retry reuses the same user-message ID and server request ID; message persistence increments the conversation count only when a message is first written. The authenticated chat route stores request state under the same user's Firestore document path, returns a cached completed response for duplicate IDs, and refuses to re-run requests that may still be executing. This prevents a retry from re-running a tool after an ambiguous connection failure. A known pre-action failure can be retried; when execution status is ambiguous, the interface tells the user to check the conversation rather than sending the action again.

Request records carry a 30-day `expiresAt` timestamp. Before enabling the new client in production, configure Firestore TTL for the `expiresAt` field on the `chatRequests` collection group. If TTL is not enabled, these user-scoped idempotency records will remain in Firestore.

Diagnostics use structured provider/operation/status fields and do not include prompts, message text, attachments, model response bodies, credentials, or user identifiers.

### Production incident status

No production Vercel logs or incident reproduction were supplied with this issue. The changes above address confirmed code-level defects: the loading guard was set only after awaiting message persistence, failed responses had no retry control, repeated saves incremented message counts again, and the standalone recorder used a form field that did not match `/api/transcribe`. These are confirmed implementation fixes, **not confirmation that a production incident is resolved**.

To confirm or diagnose the production incident, collect the affected deployment and approximate UTC time, the `/api/chat` or `/api/transcribe` function status/duration, and the structured provider/operation/status diagnostics. Reproduce in a test account by sending a message, interrupting the connection at different points, retrying, and checking for one user message, one assistant reply, and no repeated action receipt. Never send message contents, attachments, transcripts, ID tokens, authorization headers, or service credentials in logs or support notes.

## Voice capture

Home and Chat provide explicit microphone permission, press-and-hold capture, recording/transcription state, cancellation, editable transcript review, and a deliberate “Use this text” step. Text is inserted into the existing composer and is never automatically sent or executed. Media tracks are stopped on stop, cancellation, and unmount. If microphone access or `MediaRecorder` is unavailable, the normal text composer remains usable.

Voice capture requires a secure browser context, microphone permission, a supported `MediaRecorder` format, a signed-in user, and the existing OpenAI transcription configuration. Browser permission prompts, available codecs, and actual microphone hardware need manual verification; the automated suite cannot simulate these browser/device interactions.

## Manual acceptance checklist

- Complete first-run setup, skip optional questions, go back to edit an answer, and verify the review precedes saving.
- Reload during onboarding in the same browser session and verify answers resume. Sign in with an already-onboarded account and verify setup is not forced again.
- Verify profile focus/style are retained after refresh and affect chat context/style as selected.
- Rapidly press Send twice and verify a single request/message. Cause a retryable failure and use Retry; verify the same message is reused. For an ambiguous in-flight request, verify another action is not run and the interface asks the user to check the conversation.
- Enable the microphone, hold and release to record, edit the transcript, then use it. Also cancel a recording, deny permission, and navigate away while recording; verify tracks stop and text input still works.

No production deployment, environment configuration, or production user data was accessed for these checks.

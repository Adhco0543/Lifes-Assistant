export type EmailSendRequest = {
  to: string;
  subject: string;
  text: string;
};

export function validateEmailSendRequest(value: unknown):
  | { valid: true; body: EmailSendRequest }
  | { valid: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, error: 'Expected a JSON object.' };
  }

  const body = value as Record<string, unknown>;
  if (typeof body.to !== 'string' || body.to.length > 320) {
    return { valid: false, error: 'Enter a valid recipient email.' };
  }
  if (typeof body.subject !== 'string' || typeof body.text !== 'string') {
    return { valid: false, error: 'Subject and email body are required.' };
  }

  const to = body.to.trim();
  const subject = body.subject.trim();
  const text = body.text.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { valid: false, error: 'Enter a valid recipient email.' };
  }
  if (!subject || !text) {
    return { valid: false, error: 'Subject and email body are required.' };
  }
  if (/[\r\n]/.test(subject)) {
    return { valid: false, error: 'Email subject must fit on one line.' };
  }
  if (subject.length > 200 || text.length > 20_000) {
    return { valid: false, error: 'Email is too large to send.' };
  }

  return { valid: true, body: { to, subject, text } };
}

export function parseEmailProviderId(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === 'string' && id.length > 0 && id.length <= 200 ? id : null;
}

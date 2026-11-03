// Shared outbound email delivery. Used by /api/email/send (user-initiated) and by
// the tool executor when autonomy settings allow Bella to send on her own.

export type DeliveryResult =
  | { ok: true; id: string | null; provider: 'resend' }
  | { ok: false; status: number; error: string };

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.EMAIL_DOMAIN_VERIFIED === 'true');
}

export async function deliverEmail(input: { to: string; subject: string; text: string }): Promise<DeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!emailDeliveryConfigured() || !apiKey || !from) {
    return { ok: false, status: 503, error: "Email delivery is waiting for a dedicated Life's Assistant sending domain." };
  }

  const providerResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.text }),
  });
  const result = (await providerResponse.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!providerResponse.ok) {
    return { ok: false, status: providerResponse.status, error: result?.message || 'Email provider rejected the message.' };
  }
  return { ok: true, id: result?.id || null, provider: 'resend' };
}

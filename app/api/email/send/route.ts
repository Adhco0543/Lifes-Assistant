import { NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '../../../../lib/serverAuth';

type EmailRequest = {
  to?: string;
  subject?: string;
  text?: string;
};

export async function POST(request: Request) {
  if (!(await verifyFirebaseRequest(request))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const { to, subject, text } = (await request.json()) as EmailRequest;
  const recipient = String(to || '').trim();
  const emailSubject = String(subject || '').trim();
  const emailText = String(text || '').trim();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(recipient)) {
    return NextResponse.json({ error: 'Enter a valid recipient email.' }, { status: 400 });
  }

  if (!emailSubject || !emailText) {
    return NextResponse.json({ error: 'Subject and email body are required.' }, { status: 400 });
  }

  if (emailSubject.length > 200 || emailText.length > 20000) {
    return NextResponse.json({ error: 'Email is too large to send.' }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const domainVerified = process.env.EMAIL_DOMAIN_VERIFIED === 'true';

  if (!apiKey || !from || !domainVerified) {
    return NextResponse.json(
      { error: "Email delivery is waiting for a dedicated Life's Assistant sending domain." },
      { status: 503 }
    );
  }

  const providerResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: emailSubject,
      text: emailText,
    }),
  });

  const result = await providerResponse.json().catch(() => ({}));

  if (!providerResponse.ok) {
    return NextResponse.json(
      { error: result?.message || 'Email provider rejected the message.' },
      { status: providerResponse.status }
    );
  }

  return NextResponse.json({ ok: true, id: result?.id || null, provider: 'resend' });
}

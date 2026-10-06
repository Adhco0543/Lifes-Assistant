import { NextResponse } from 'next/server';
import { Resend } from 'resend';
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

  const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
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

  if (!apiKey || !from) {
    return NextResponse.json({ error: 'Email service is not configured.' }, { status: 503 });
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to: recipient,
    subject: emailSubject,
    text: emailText,
  });

  if (result.error) {
    return NextResponse.json(
      { error: result.error.message || 'Email provider rejected the message.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, id: result.data?.id || null });
}

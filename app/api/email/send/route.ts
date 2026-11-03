import { NextResponse } from 'next/server';
import { verifyFirebaseRequest } from '../../../../lib/serverAuth';
import { deliverEmail } from '../../../../lib/emailDelivery';

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

  const delivery = await deliverEmail({ to: recipient, subject: emailSubject, text: emailText });
  if (!delivery.ok) {
    return NextResponse.json({ error: delivery.error }, { status: delivery.status });
  }

  return NextResponse.json({ ok: true, id: delivery.id, provider: delivery.provider });
}

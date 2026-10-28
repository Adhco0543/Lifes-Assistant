import { NextResponse } from 'next/server';
import { validateEmailSendRequest, parseEmailProviderId } from '../../../../lib/emailApiContracts';
import { reportIntegrationFailure } from '../../../../lib/integrationDiagnostics';
import { readLimitedJson } from '../../../../lib/requestLimits';
import { verifyFirebaseRequest } from '../../../../lib/serverAuth';

export async function POST(request: Request) {
  if (!(await verifyFirebaseRequest(request))) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const body = await readLimitedJson(request, 64_000);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.status === 413 ? 'Email is too large to send.' : 'Invalid email request.' },
      { status: body.status }
    );
  }

  const validation = validateEmailSendRequest(body.value);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const domainVerified = process.env.EMAIL_DOMAIN_VERIFIED === 'true';

  if (!apiKey || !from || !domainVerified) {
    return NextResponse.json(
      { error: "Email delivery is waiting for a dedicated Life's Assistant sending domain." },
      { status: 503 }
    );
  }

  try {
    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [validation.body.to],
        subject: validation.body.subject,
        text: validation.body.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!providerResponse.ok) {
      reportIntegrationFailure('resend', 'request', providerResponse.status);
      return NextResponse.json(
        { error: 'Email provider could not send the message. Check the address and try again.' },
        { status: 502 }
      );
    }

    const result = await providerResponse.json().catch(() => null);
    const id = parseEmailProviderId(result);
    if (!id) {
      reportIntegrationFailure('resend', 'parse-response', providerResponse.status);
      return NextResponse.json({ error: 'Email provider returned an invalid response.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, id, provider: 'resend' });
  } catch {
    reportIntegrationFailure('resend', 'request');
    return NextResponse.json(
      { error: 'Email could not be sent right now. Try again in a moment.' },
      { status: 502 }
    );
  }
}

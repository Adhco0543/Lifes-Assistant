import { NextResponse } from 'next/server';

export async function GET() {
  const result = {
    app: { ready: true },
    ai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
    },
    firebase: {
      configured: Boolean(
        process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ),
    },
    email: {
      configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
      domainVerified: false,
      domainStatus: 'unknown',
      sender: process.env.EMAIL_FROM || null,
    },
  };

  const apiKey = process.env.RESEND_API_KEY;
  const domainId = process.env.RESEND_DOMAIN_ID;

  if (apiKey && domainId) {
    try {
      const response = await fetch('https://api.resend.com/domains/' + domainId, {
        headers: { Authorization: 'Bearer ' + apiKey },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        result.email.domainStatus = String(data?.status || 'unknown');
        result.email.domainVerified = data?.status === 'verified';
      } else {
        result.email.domainStatus = 'provider-check-failed';
      }
    } catch {
      result.email.domainStatus = 'provider-check-failed';
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

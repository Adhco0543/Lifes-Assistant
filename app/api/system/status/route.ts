import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const firebaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );

  const emailConfigured = Boolean(
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL &&
    process.env.RESEND_DOMAIN_ID
  );

  return NextResponse.json({
    app: { ok: true },
    ai: {
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || 'gpt-6-luna',
    },
    firebase: {
      configured: firebaseConfigured,
    },
    email: {
      configured: emailConfigured,
      provider: 'resend',
    },
    version: 'release-candidate',
    checkedAt: new Date().toISOString(),
  });
}

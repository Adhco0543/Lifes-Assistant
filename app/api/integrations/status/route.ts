import { NextResponse } from 'next/server';

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lifes-assistant.vercel.app';

  const googleServerOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
    process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
  const googleFirebaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim()
  );

  return NextResponse.json({
    google: {
      configured: googleServerOAuthConfigured || googleFirebaseConfigured,
      mode: googleServerOAuthConfigured
        ? 'server-oauth'
        : googleFirebaseConfigured
          ? 'firebase'
          : 'none',
      callbackUrl: appUrl + '/api/integrations/google/callback',
      services: ['drive', 'gmail', 'calendar', 'photos'],
    },
    github: {
      configured: Boolean(
        process.env.GITHUB_CLIENT_ID?.trim() &&
        process.env.GITHUB_CLIENT_SECRET?.trim()
      ),
      callbackUrl: appUrl + '/api/integrations/github/callback',
      supportsPrivateRepositories: true,
    },
    providers: {
      microsoft: 'planned',
      dropbox: 'planned',
      apple: 'native-app-path',
    },
  });
}

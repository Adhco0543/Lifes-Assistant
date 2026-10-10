import { NextResponse } from 'next/server';

export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://lifes-assistant.vercel.app';

  return NextResponse.json({
    google: {
      configured: Boolean(
        process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim()
      ),
      callbackUrl: appUrl + '/api/integrations/google/callback',
      services: ['drive', 'gmail', 'calendar', 'photos'],
    },
    providers: {
      microsoft: 'planned',
      dropbox: 'planned',
      apple: 'native-app-path',
      github: 'planned',
    },
  });
}

export type FirebaseRequestUser = {
  uid: string;
  email?: string;
  displayName?: string;
};

export function parseFirebaseLookupUser(value: unknown): FirebaseRequestUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const users = (value as Record<string, unknown>).users;
  if (!Array.isArray(users) || !users[0] || typeof users[0] !== 'object' || Array.isArray(users[0])) {
    return null;
  }

  const user = users[0] as Record<string, unknown>;
  if (typeof user.localId !== 'string' || !user.localId.trim() || user.localId.length > 256) {
    return null;
  }

  return {
    uid: user.localId,
    ...(typeof user.email === 'string' && user.email.length <= 320 ? { email: user.email } : {}),
    ...(typeof user.displayName === 'string' && user.displayName.length <= 200
      ? { displayName: user.displayName }
      : {}),
  };
}

export async function getFirebaseRequestUser(
  request: Request
): Promise<FirebaseRequestUser | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!token || token.length > 10_000 || !apiKey) {
    return null;
  }

  try {
    const response = await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
        encodeURIComponent(apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      }
    );

    if (!response.ok) return null;

    return parseFirebaseLookupUser(await response.json().catch(() => null));
  } catch {
    return null;
  }
}

export async function verifyFirebaseRequest(request: Request) {
  return Boolean(await getFirebaseRequestUser(request));
}

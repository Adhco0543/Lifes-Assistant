export type FirebaseRequestUser = {
  uid: string;
  email?: string;
  displayName?: string;
};

export function parseFirebaseLookupUser(value: unknown): FirebaseRequestUser | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const users = (value as { users?: unknown }).users;
  if (!Array.isArray(users) || !users.length) return null;
  const user = users[0];
  if (!user || typeof user !== 'object' || Array.isArray(user)) return null;
  const record = user as Record<string, unknown>;
  if (typeof record.localId !== 'string' || !record.localId.trim() || record.localId.length > 256) return null;
  const email = typeof record.email === 'string' && record.email.length <= 320 ? record.email : undefined;
  const displayName = typeof record.displayName === 'string' && record.displayName.length <= 200 ? record.displayName : undefined;
  return { uid: record.localId, email, displayName };
}

export async function getFirebaseRequestUser(
  request: Request
): Promise<FirebaseRequestUser | null> {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!token || !apiKey) {
    return null;
  }

  const response = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
      encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return null;
  }

  const data: unknown = await response.json();
  return parseFirebaseLookupUser(data);
}

export async function verifyFirebaseRequest(request: Request) {
  return Boolean(await getFirebaseRequestUser(request));
}

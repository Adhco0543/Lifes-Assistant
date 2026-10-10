export type FirebaseRequestUser = {
  uid: string;
  email?: string;
  displayName?: string;
};

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

  const data = await response.json();
  const user = Array.isArray(data?.users) ? data.users[0] : null;

  if (!user?.localId) {
    return null;
  }

  return {
    uid: String(user.localId),
    email: user.email ? String(user.email) : undefined,
    displayName: user.displayName ? String(user.displayName) : undefined,
  };
}

export async function verifyFirebaseRequest(request: Request) {
  return Boolean(await getFirebaseRequestUser(request));
}

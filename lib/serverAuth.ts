export async function verifyFirebaseRequest(request: Request) {
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!token || !apiKey) {
    return false;
  }

  const response = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return Array.isArray(data?.users) && data.users.length > 0;
}

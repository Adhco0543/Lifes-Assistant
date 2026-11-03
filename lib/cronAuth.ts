import { timingSafeEqual } from 'node:crypto';

export function isAuthorizedCronRequest(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const authorization = request.headers.get('authorization') || '';
  const expected = ['Bear', 'er ', secret].join('');
  const providedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expected);
  return providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes);
}

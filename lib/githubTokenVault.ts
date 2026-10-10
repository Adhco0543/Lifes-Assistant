import crypto from 'node:crypto';

function tokenKey(): Buffer {
  const raw = process.env.INTEGRATION_TOKEN_SECRET?.trim();
  if (!raw) throw new Error('Integration token encryption is not configured.');
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  return crypto.createHash('sha256').update(raw).digest();
}

export function sealGitHubTokenBundle(data: Record<string, unknown>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function openGitHubTokenBundle(value: string): Record<string, unknown> {
  const [version, ivText, tagText, encryptedText] = value.split('.');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new Error('Invalid GitHub token bundle.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    tokenKey(),
    Buffer.from(ivText, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plaintext) as Record<string, unknown>;
}

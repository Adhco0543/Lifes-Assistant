export function parseTranscriptionResult(value: unknown): { text: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = (value as Record<string, unknown>).text;
  if (typeof text !== 'string' || !text.trim() || text.length > 500_000) return null;
  return { text };
}

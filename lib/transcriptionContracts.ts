export const TRANSCRIPTION_AUDIO_FIELD = 'audio';

export function transcriptionFileName(mimeType: string): string {
  const type = mimeType.toLowerCase();
  if (type.includes('mp4') || type.includes('m4a')) return 'recording.mp4';
  if (type.includes('ogg')) return 'recording.ogg';
  if (type.includes('wav')) return 'recording.wav';
  return 'recording.webm';
}

export function parseTranscriptionResult(value: unknown): { text: string } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const text = (value as Record<string, unknown>).text;
  if (typeof text !== 'string' || !text.trim() || text.length > 500_000) return null;
  return { text };
}

export type ChatApiResponse = {
  type: 'chat' | 'quote' | 'email' | 'task';
  message: string;
  githubReviewStatus?: string;
  data?: Record<string, unknown>;
};

export function parseChatApiResponse(value: unknown): ChatApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid chat response.');
  }
  const record = value as Record<string, unknown>;
  if (typeof record.message !== 'string' || !record.message.trim() || record.message.length > 200_000) {
    throw new Error('Invalid chat response.');
  }
  const validTypes = ['chat', 'quote', 'email', 'task'];
  if (record.type !== undefined && (typeof record.type !== 'string' || !validTypes.includes(record.type))) {
    throw new Error('Invalid chat response.');
  }
  if (record.data !== undefined && (!record.data || typeof record.data !== 'object' || Array.isArray(record.data))) {
    throw new Error('Invalid chat response.');
  }
  if (record.githubReviewStatus !== undefined && (typeof record.githubReviewStatus !== 'string' || record.githubReviewStatus.length > 2000)) {
    throw new Error('Invalid chat response.');
  }
  return {
    type: (record.type as ChatApiResponse['type']) || 'chat',
    message: record.message,
    ...(typeof record.githubReviewStatus === 'string' ? { githubReviewStatus: record.githubReviewStatus } : {}),
    ...(record.data && typeof record.data === 'object' ? { data: record.data as Record<string, unknown> } : {}),
  };
}

export function validateChatRequest(value: unknown):
  | { valid: true; body: Record<string, unknown> }
  | { valid: false; error: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, error: 'Expected a JSON object.' };
  }
  const body = value as Record<string, unknown>;
  for (const key of ['message', 'input', 'content']) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || (body[key] as string).length > 60_000)) {
      return { valid: false, error: 'Invalid message input.' };
    }
  }
  for (const key of ['attachments', 'history', 'persistentMemory', 'messages']) {
    if (body[key] !== undefined && !Array.isArray(body[key])) {
      return { valid: false, error: 'Invalid ' + key + ' input.' };
    }
  }
  if (Array.isArray(body.attachments)) {
    if (body.attachments.length > 3) {
      return { valid: false, error: 'Too many attachments.' };
    }
    let declaredBytes = 0;
    let encodedChars = 0;
    for (const item of body.attachments) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return { valid: false, error: 'Invalid attachment.' };
      }
      const part = item as Record<string, unknown>;
      if (typeof part.name !== 'string' || typeof part.type !== 'string' ||
          typeof part.dataUrl !== 'string' || typeof part.size !== 'number' ||
          !Number.isFinite(part.size) || part.size <= 0) {
        return { valid: false, error: 'Invalid attachment.' };
      }
      declaredBytes += part.size;
      encodedChars += part.dataUrl.length;
    }
    if (declaredBytes > 2_400_000 || encodedChars > 3_500_000) {
      return { valid: false, error: 'Attachments are too large.' };
    }
  }
  if (Array.isArray(body.history) && body.history.length > 2000) {
    return { valid: false, error: 'Too many history messages.' };
  }
  return { valid: true, body };
}

export type ResponsesApiResult = {
  status?: string;
  incomplete_details?: { reason?: string };
  usage?: { output_tokens?: number };
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

export function parseResponsesApiResult(value: unknown): ResponsesApiResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid AI response.');
  }
  const data = value as Record<string, unknown>;
  const result: ResponsesApiResult = {};
  if (typeof data.status === 'string') result.status = data.status.slice(0, 100);
  if (typeof data.output_text === 'string') result.output_text = data.output_text.slice(0, 300_000);
  if (data.incomplete_details && typeof data.incomplete_details === 'object' && !Array.isArray(data.incomplete_details)) {
    const reason = (data.incomplete_details as Record<string, unknown>).reason;
    if (typeof reason === 'string') result.incomplete_details = { reason: reason.slice(0, 80) };
  }
  if (data.usage && typeof data.usage === 'object' && !Array.isArray(data.usage)) {
    const tokens = (data.usage as Record<string, unknown>).output_tokens;
    if (typeof tokens === 'number' && Number.isFinite(tokens)) result.usage = { output_tokens: tokens };
  }
  if (Array.isArray(data.output)) {
    result.output = data.output.slice(0, 40).filter((item): item is Record<string, unknown> =>
      !!item && typeof item === 'object' && !Array.isArray(item)
    ).map((item) => ({
      type: typeof item.type === 'string' ? item.type.slice(0, 100) : undefined,
      content: Array.isArray(item.content)
        ? item.content.slice(0, 80).filter((part): part is Record<string, unknown> =>
          !!part && typeof part === 'object' && !Array.isArray(part)
        ).map((part) => ({
          type: typeof part.type === 'string' ? part.type.slice(0, 100) : undefined,
          text: typeof part.text === 'string' ? part.text.slice(0, 300_000) : undefined,
        }))
        : undefined,
    }));
  }
  return result;
}

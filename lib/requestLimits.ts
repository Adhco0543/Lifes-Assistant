export type LimitedBodyResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 413 };

/**
 * Fast path only: the content-length header can be missing, wrong, or absent for
 * chunked requests, so callers must still use the readLimited* helpers below.
 */
export function isDeclaredBodyTooLarge(request: Request, maxBytes: number): boolean {
  const declared = Number(request.headers.get('content-length') || 0);
  return Number.isFinite(declared) && declared > maxBytes;
}

export async function readLimitedBytes(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyResult<Uint8Array>> {
  if (isDeclaredBodyTooLarge(request, maxBytes)) return { ok: false, status: 413 };
  if (!request.body) return { ok: true, value: new Uint8Array(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, value: bytes };
}

export async function readLimitedText(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyResult<string>> {
  const result = await readLimitedBytes(request, maxBytes);
  if (!result.ok) return result;
  return { ok: true, value: new TextDecoder().decode(result.value) };
}

/** Reads the real body size before JSON.parse. Malformed JSON yields a null value. */
export async function readLimitedJson(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyResult<unknown>> {
  const result = await readLimitedText(request, maxBytes);
  if (!result.ok) return result;
  try {
    return { ok: true, value: JSON.parse(result.value) };
  } catch {
    return { ok: true, value: null };
  }
}

/** Reads a multipart upload with the byte limit enforced on the actual body. */
export async function readLimitedFormData(
  request: Request,
  maxBytes: number
): Promise<LimitedBodyResult<FormData>> {
  const result = await readLimitedBytes(request, maxBytes);
  if (!result.ok) return result;
  try {
    const form = await new Response(result.value as BodyInit, {
      headers: { 'content-type': request.headers.get('content-type') || '' },
    }).formData();
    return { ok: true, value: form };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function isFileTooLarge(file: { size: number }, maxBytes: number): boolean {
  return file.size > maxBytes;
}

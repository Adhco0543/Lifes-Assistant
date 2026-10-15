/**
 * Structured diagnostics intentionally omit Error objects, URLs, request bodies,
 * tokens, response bodies, user IDs, email addresses and provider messages.
 */
export type IntegrationProvider = 'google' | 'github' | 'openai' | 'gateway' | 'chat' | 'firebase' | 'radar';
export type IntegrationOperation = 'revoke' | 'verify' | 'refresh' | 'connect' | 'request' | 'parse-response' | 'save' | 'load';

export function reportIntegrationFailure(
  provider: IntegrationProvider,
  operation: IntegrationOperation,
  status?: number
): void {
  console.warn('[integration]', {
    provider,
    operation,
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599
      ? { status }
      : {}),
  });
}

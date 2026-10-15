import type { ChatMessage } from './firebaseBackend';

const MAX_CURRENT_CONTEXT_CHARS = 12000;
const MAX_CONTEXT_MESSAGE_CHARS = 3200;
const MAX_PRIOR_MESSAGE_CHARS = 900;

export function trimForContext(value: string, maxChars: number): string {
  const text = value.trim();
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.38);
  const tail = maxChars - head - 35;
  return text.slice(0, head) + '\n[…middle shortened…]\n' + text.slice(-tail);
}

export function currentChatContext(messages: ChatMessage[]) {
  const eligible = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
  let chars = 0;
  const selected: ChatMessage[] = [];
  for (let index = eligible.length - 1; index >= 0; index--) {
    const message = eligible[index];
    const compactContent = trimForContext(message.content, MAX_CONTEXT_MESSAGE_CHARS);
    const compactMessage = { ...message, content: compactContent };
    const length = compactContent.length;
    if (chars + length > MAX_CURRENT_CONTEXT_CHARS && selected.length) break;
    selected.unshift(compactMessage);
    chars += length;
  }
  return { selected: selected.map(({ role, content }) => ({ role, content })),
    omitted: eligible.length - selected.length };
}

export function recallKeywords(value: string): string[] {
  const stopWords = new Set(['about', 'what', 'when', 'where', 'which', 'that', 'this', 'with',
    'have', 'from', 'there', 'their', 'were', 'talk', 'talked', 'discuss', 'discussed',
    'remember', 'recall', 'yesterday', 'before', 'previous', 'last', 'chat', 'conversation']);
  return [...new Set((value.toLowerCase().match(/[a-z0-9]{4,}/g) || [])
    .filter((word) => !stopWords.has(word)))].slice(0, 12);
}

export function compactConversationMessages(
  messages: ChatMessage[],
  keywords: string[],
  limit = 16
): ChatMessage[] {
  if (messages.length <= limit) {
    return messages.map((message) => ({
      ...message,
      content: trimForContext(message.content, MAX_PRIOR_MESSAGE_CHARS),
    }));
  }

  const selected = new Set<number>();
  const add = (index: number) => {
    if (index >= 0 && index < messages.length) selected.add(index);
  };

  add(0);
  add(1);
  for (let index = Math.max(0, messages.length - 6); index < messages.length; index++) add(index);

  if (keywords.length) {
    messages.forEach((message, index) => {
      const lower = message.content.toLowerCase();
      if (keywords.some((keyword) => lower.includes(keyword))) {
        add(index - 1);
        add(index);
        add(index + 1);
      }
    });
  }

  const userIndexes = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === 'user')
    .map(({ index }) => index);

  if (selected.size < limit && userIndexes.length) {
    const remaining = Math.max(1, limit - selected.size);
    const stride = Math.max(1, Math.floor(userIndexes.length / remaining));
    for (let i = 0; i < userIndexes.length && selected.size < limit; i += stride) {
      add(userIndexes[i]);
    }
  }

  for (let index = messages.length - 1; index >= 0 && selected.size < limit; index--) add(index);

  return [...selected]
    .sort((a, b) => a - b)
    .slice(-limit)
    .map((index) => ({
      ...messages[index],
      content: trimForContext(messages[index].content, MAX_PRIOR_MESSAGE_CHARS),
    }));
}

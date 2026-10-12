'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import type { ChatAttachmentMeta, ChatMessage, Conversation } from '../lib/firebaseBackend';

interface AdvancedChatProps {
  userId?: string;
  businessContext?: string;
  onClose?: () => void;
  fullScreen?: boolean;
}

type ChatApiResponse = {
  type?: 'chat' | 'quote' | 'email' | 'task' | string;
  message?: string;
  githubReviewStatus?: string;
  data?: any;
};

type PendingAttachment = ChatAttachmentMeta & {
  id: string;
  dataUrl: string;
};

const MAX_ATTACHMENT_BYTES = 2_400_000;
const MAX_ATTACHMENTS = 3;
const MAX_VISIBLE_CHAT_MESSAGES = 2000;
const MAX_CURRENT_CONTEXT_CHARS = 24000;
const MAX_PRIOR_CONTEXT_CHARS = 14000;
const MAX_CONTEXT_MESSAGE_CHARS = 5000;
const MAX_PRIOR_MESSAGE_CHARS = 1400;
const MAX_RECALL_CONVERSATIONS = 10;
const MAX_RECALL_MESSAGES_PER_CONVERSATION = 400;

function trimForContext(value: string, maxChars: number): string {
  const text = value.trim();
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.38);
  const tail = maxChars - head - 35;
  return text.slice(0, head) + '\n[…middle shortened…]\n' + text.slice(-tail);
}

function currentChatContext(messages: ChatMessage[]) {
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

function recallKeywords(value: string): string[] {
  const stopWords = new Set(['about', 'what', 'when', 'where', 'which', 'that', 'this', 'with',
    'have', 'from', 'there', 'their', 'were', 'talk', 'talked', 'discuss', 'discussed',
    'remember', 'recall', 'yesterday', 'before', 'previous', 'last', 'chat', 'conversation']);
  return [...new Set((value.toLowerCase().match(/[a-z0-9]{4,}/g) || [])
    .filter((word) => !stopWords.has(word)))].slice(0, 12);
}

function compactConversationMessages(
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
const SUPPORTED_ATTACHMENT_EXTENSIONS =
  /\.(pdf|txt|md|json|html?|xml|rtf|odt|docx?|pptx?|xlsx?|csv|tsv|iif|png|jpe?g|webp|gif|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|swift|kt|kts|sh|sql|yaml|yml)$/i;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Could not read file.'));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo.'));
    };
    image.src = url;
  });
}

async function prepareImageAttachment(
  file: File,
  id: string
): Promise<PendingAttachment> {
  const image = await loadImageFromFile(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo processing is not available in this browser.');

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.84;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlByteSize(dataUrl) > 1_600_000 && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }

  const originalBase = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return {
    id,
    name: originalBase + '.jpg',
    type: 'image/jpeg',
    size: dataUrlByteSize(dataUrl),
    dataUrl,
  };
}

type RadarApiLoop = {
  title: string;
  summary?: string;
  status: 'open' | 'waiting';
  priority: 'low' | 'medium' | 'high';
  waitingOn?: string;
  nextAction?: string;
  linkedView?: string;
  dueDate?: string;
};

type RadarApiResponse = {
  openLoops?: RadarApiLoop[];
  resolveLoopIds?: string[];
};

function normalizeLoopKey(title: string, waitingOn?: string): string {
  return (title + '|' + (waitingOn || ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function localNoonFromDateKey(dateKey?: string): number | null {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  const value = new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
  return Number.isFinite(value) ? value : null;
}

const DEFAULT_ASSISTANT_NAME = 'Bella';

const normalizeAssistantName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : '';
  return !name || name === "Life's Assistant" ? DEFAULT_ASSISTANT_NAME : name;
};

export const AdvancedConversationalChat: React.FC<AdvancedChatProps> = ({
  userId = 'default-user',
  businessContext,
  onClose,
  fullScreen = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState('');
  const [chatbotName, setChatbotName] = useState(DEFAULT_ASSISTANT_NAME);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(DEFAULT_ASSISTANT_NAME);
  const [isListening, setIsListening] = useState(false);
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [persistentMemory, setPersistentMemory] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<ChatApiResponse | null>(null);
  const [queuedLaunch, setQueuedLaunch] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingConversationId, setLoadingConversationId] = useState('');
  const [conversationLoadError, setConversationLoadError] = useState('');
  const conversationLoadSequence = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      const savedName = localStorage.getItem('chatbot_name:' + userId);
      if (savedName) {
        const resolvedName = normalizeAssistantName(savedName);
        setChatbotName(resolvedName);
        setNameInput(resolvedName);
        if (resolvedName !== savedName) {
          localStorage.setItem('chatbot_name:' + userId, resolvedName);
        }
      }

      try {
        const cloudPrefs = await firebaseBackend.getLatestDraft('assistant-preferences');
        if (!active || !cloudPrefs) return;

        if (typeof cloudPrefs.assistantName === 'string' && cloudPrefs.assistantName.trim()) {
          const resolvedName = normalizeAssistantName(cloudPrefs.assistantName);
          setChatbotName(resolvedName);
          setNameInput(resolvedName);
        }

        if (cloudPrefs.tone === 'concise' || cloudPrefs.tone === 'balanced' || cloudPrefs.tone === 'detailed') {
          setResponseStyle(cloudPrefs.tone);
        }

        if (typeof cloudPrefs.memoryEnabled === 'boolean') {
          setMemoryEnabled(cloudPrefs.memoryEnabled);
        }
      } catch {
        // Local preferences remain available if cloud preferences cannot load.
      }
    };

    loadPreferences();
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    let active = true;

    const loadPersistentMemory = async () => {
      try {
        const records = await firebaseBackend.getRecentBusinessRecords(100);
        if (!active) return;

        const memories = records
          .filter((record) => record.kind === 'memory')
          .map((record) => String(((record.data || {}) as Record<string, unknown>).text || '').trim())
          .filter(Boolean);

        const people = records
          .filter((record) => record.kind === 'person')
          .map((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            const name = String(data.name || '').trim();
            if (!name) return '';
            const relationship = String(data.relationship || '').trim();
            const notes = String(data.notes || '').trim();
            return [
              'Person: ' + name,
              relationship ? 'Relationship: ' + relationship : '',
              notes ? 'Context: ' + notes : '',
            ].filter(Boolean).join(' · ');
          })
          .filter(Boolean);

        const projects = records
          .filter((record) => record.kind === 'project')
          .map((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            const name = String(data.name || '').trim();
            if (!name) return '';
            const goal = String(data.goal || '').trim();
            const status = String(data.status || 'active').trim();
            const notes = String(data.notes || '').trim();
            return [
              'Project: ' + name,
              'Status: ' + status,
              goal ? 'Goal: ' + goal : '',
              notes ? 'Context: ' + notes : '',
            ].filter(Boolean).join(' · ');
          })
          .filter(Boolean);

        setPersistentMemory(memories.concat(people, projects).slice(0, 50));
      } catch {
        if (active) setPersistentMemory([]);
      }
    };

    loadPersistentMemory();
    return () => {
      active = false;
    };
  }, [userId]);

  const loadConversation = useCallback(async (conversationId: string) => {
    const requestNumber = ++conversationLoadSequence.current;
    setLoadingConversationId(conversationId);
    setConversationLoadError('');
    try {
      if (!firebaseBackend.isAvailable() || !firebaseBackend.getCurrentUser()) {
        throw new Error('Sign in to access saved conversations.');
      }

      const msgs = await firebaseBackend.getMessages(conversationId, MAX_VISIBLE_CHAT_MESSAGES);
      if (requestNumber !== conversationLoadSequence.current) return;
      setMessages(msgs);
      setCurrentConversationId(conversationId);
      localStorage.setItem('life-chat-current:' + userId, conversationId);
      setHistoryStatus(msgs.length
        ? 'Conversation restored from your account.'
        : 'This conversation has no saved messages yet.');
      setPendingAction(null);
      setHistoryOpen(false);
    } catch (error) {
      if (requestNumber !== conversationLoadSequence.current) return;
      console.error('Error loading conversation:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      setConversationLoadError('Could not open that conversation: ' + message);
      setHistoryStatus('Could not open saved messages. Your current chat was not changed.');
      setHistoryOpen(true);
    } finally {
      if (requestNumber === conversationLoadSequence.current) {
        setLoadingConversationId('');
      }
    }
  }, [userId]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const initializeChat = async () => {
      try {
        console.log('[Chat] Initializing chat for userId:', userId);
        await firebaseBackend.initialize();

        const currentUser = firebaseBackend.getCurrentUser();

        if (firebaseBackend.isAvailable() && currentUser) {
          unsubscribe = firebaseBackend.onConversationsChange((convs) => {
            if (!cancelled) setConversations(convs);
          });

          const existingConvs = await firebaseBackend.getConversations(100);
          if (cancelled) return;

          setConversations(existingConvs);

          if (existingConvs.length > 0) {
            const rememberedId = localStorage.getItem('life-chat-current:' + userId);
            const selected = existingConvs.find((conv) => conv.id === rememberedId) || existingConvs[0];
            await loadConversation(selected.id);
          } else {
            const newConvId = await firebaseBackend.createConversation('New Chat', businessContext);
            if (!cancelled) {
              setCurrentConversationId(newConvId);
              localStorage.setItem('life-chat-current:' + userId, newConvId);
              setHistoryStatus('New conversation ready. Messages will be saved to your account.');
            }
          }
        } else {
          const welcomeMsg: ChatMessage = {
            id: 'welcome',
            userId: userId || 'local-user',
            conversationId: 'local',
            role: 'assistant',
            content:
              "👋 Hi! I'm Bella. I can help with everyday planning, work, writing, tasks, reminders, memory, projects, estimates, and turning ideas into finished actions.",
            timestamp: Date.now(),
          };

          setMessages([welcomeMsg]);
          setHistoryStatus('Not signed in. This chat is not being saved to the cloud.');
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        setHistoryStatus('Could not connect to saved chat history. Messages may not be preserved.');

        const welcomeMsg: ChatMessage = {
          id: 'welcome',
          userId: userId || 'local-user',
          conversationId: 'local',
          role: 'assistant',
          content:
            "👋 Hi! I'm Bella. I can help organize life and work, remember useful context, draft things, plan projects, and turn conversations into actions.",
          timestamp: Date.now(),
        };

        setMessages([welcomeMsg]);
      } finally {
        if (!cancelled) {
          setIsInitialized(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    };

    initializeChat();

    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, [userId, businessContext, loadConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isInitialized) return;

    const key = 'assistant_launch_prompt:' + userId;
    const prompt = localStorage.getItem(key);
    if (!prompt) return;

    localStorage.removeItem(key);
    setInput(prompt);
    setQueuedLaunch(true);
    window.setTimeout(() => inputRef.current?.focus(), 80);
  }, [isInitialized, userId]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);

    recognitionRef.current.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          setInput((prev) => `${prev}${transcript} `);
        }
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
  }, []);

  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setInput('');
      recognitionRef.current.start();
    }
  };

  const createNewConversation = useCallback(async () => {
    try {
      if (!firebaseBackend.isAvailable()) {
        setMessages([]);
        setCurrentConversationId('local');
        setInput('');
        return;
      }

      const title = `Chat ${new Date().toLocaleDateString()}`;
      const newConvId = await firebaseBackend.createConversation(title, businessContext);
      ++conversationLoadSequence.current;
      setLoadingConversationId('');
      setHistoryOpen(false);
      setConversationLoadError('');
      setCurrentConversationId(newConvId);
      localStorage.setItem('life-chat-current:' + userId, newConvId);
      setHistoryStatus('New conversation ready. Messages will be saved to your account.');
      setMessages([]);
      setInput('');
      setAttachments([]);
      setAttachmentError('');
      setPendingAction(null);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }, [businessContext, userId]);

  useEffect(() => {
    const handleNewConversation = () => {
      createNewConversation();
    };

    window.addEventListener('new-conversation', handleNewConversation);
    return () => window.removeEventListener('new-conversation', handleNewConversation);
  }, [createNewConversation]);

  const captureLifeRadar = useCallback(async (message: string) => {
    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) return;

      const existing = await firebaseBackend.getOpenLoops(50);
      const activeConversationLoops = existing
        .filter(
          (loop) =>
            loop.status !== 'resolved' &&
            loop.source === 'conversation'
        )
        .slice(0, 20);

      const response = await fetch('/api/life-radar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          message,
          conversationId: currentConversationId || undefined,
          businessContext,
          localDate: localDateKey(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          activeLoops: activeConversationLoops.map((loop) => ({
            id: loop.id,
            title: loop.title,
            summary: loop.summary,
            waitingOn: loop.waitingOn,
          })),
        }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as RadarApiResponse;
      const detected = Array.isArray(data.openLoops) ? data.openLoops : [];
      const resolvedIds = new Set(
        Array.isArray(data.resolveLoopIds) ? data.resolveLoopIds : []
      );

      for (const loop of activeConversationLoops) {
        if (resolvedIds.has(loop.id)) {
          await firebaseBackend.resolveOpenLoop(loop.id);
        }
      }

      const knownKeys = new Set(
        existing
          .filter(
            (loop) =>
              loop.status !== 'resolved' && !resolvedIds.has(loop.id)
          )
          .map((loop) => normalizeLoopKey(loop.title, loop.waitingOn))
      );

      let createdCount = 0;

      for (const loop of detected) {
        const key = normalizeLoopKey(loop.title, loop.waitingOn);
        if (!key || knownKeys.has(key)) continue;

        await firebaseBackend.createOpenLoop({
          title: loop.title,
          summary: loop.summary,
          status: loop.status,
          priority: loop.priority,
          waitingOn: loop.waitingOn,
          nextAction: loop.nextAction,
          dueAt: localNoonFromDateKey(loop.dueDate),
          source: 'conversation',
          sourceId: currentConversationId || undefined,
          sourceExcerpt: message.slice(0, 280),
          linkedView: loop.linkedView || 'tasks',
          snoozedUntil: null,
        });

        knownKeys.add(key);
        createdCount += 1;
      }

      if (createdCount || resolvedIds.size) {
        await firebaseBackend.trackEvent('life_radar.captured', {
          createdCount,
          resolvedCount: resolvedIds.size,
          conversationId: currentConversationId || null,
        });
      }
    } catch (error) {
      console.warn('Life Radar capture skipped:', error);
    }
  }, [businessContext, currentConversationId]);

  const handleToolHandoff = async (data: ChatApiResponse) => {
    const payload = (data.data || {}) as Record<string, unknown>;

    if (data.type === 'quote') {
      try {
        await firebaseBackend.saveDraft('handoff-quote', payload);
      } catch {
        localStorage.setItem('quote_draft', JSON.stringify(payload));
      }
      window.dispatchEvent(new CustomEvent('open-quote-builder'));
    }

    if (data.type === 'email') {
      try {
        await firebaseBackend.saveDraft('handoff-email', payload);
      } catch {
        localStorage.setItem('email_draft', JSON.stringify(payload));
      }
      window.dispatchEvent(new CustomEvent('open-email'));
    }

    if (data.type === 'task') {
      try {
        await firebaseBackend.saveDraft('handoff-task', payload);
      } catch {
        localStorage.setItem('task_draft', JSON.stringify(payload));
      }
      window.dispatchEvent(new CustomEvent('open-tasks'));
    }
  };

  const addFiles = async (files: File[]) => {
    if (!files.length) return;

    setAttachmentError('');

    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (!room) {
      setAttachmentError('You can attach up to ' + MAX_ATTACHMENTS + ' files per message.');
      return;
    }

    const chosen = files.slice(0, room);
    const unsupported = chosen.find(
      (file) => !file.type.startsWith('image/') && !SUPPORTED_ATTACHMENT_EXTENSIONS.test(file.name)
    );
    if (unsupported) {
      setAttachmentError(unsupported.name + ' is not a supported chat attachment.');
      return;
    }

    try {
      const next = await Promise.all(
        chosen.map(async (file, index) => {
          const id = Date.now() + '-' + index + '-' + file.name;

          if (file.type.startsWith('image/')) {
            return prepareImageAttachment(file, id);
          }

          return {
            id,
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl: await readFileAsDataUrl(file),
          } satisfies PendingAttachment;
        })
      );

      const existingBytes = attachments.reduce((sum, item) => sum + item.size, 0);
      const addedBytes = next.reduce((sum, item) => sum + item.size, 0);

      if (existingBytes + addedBytes > MAX_ATTACHMENT_BYTES) {
        setAttachmentError('Keep the combined attachments under 2.4 MB for now.');
        return;
      }

      setAttachments((current) => current.concat(next).slice(0, MAX_ATTACHMENTS));
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : 'One of those files could not be read. Try it again.'
      );
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await addFiles(files);
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id));
    setAttachmentError('');
  };

  const handleSendMessage = useCallback(async () => {
    if ((!input.trim() && !attachments.length) || isLoading) return;

    const outgoingAttachments = attachments;
    const typedMessage = input.trim();
    const userMessage =
      typedMessage ||
      'Attached ' + outgoingAttachments.map((item) => item.name).join(', ') + '.';
    setInput('');
    setAttachments([]);
    setAttachmentError('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      userId: firebaseBackend.getCurrentUser()?.uid || userId || 'local-user',
      conversationId: currentConversationId || 'local',
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
      attachments: outgoingAttachments.map(({ name, type, size }) => ({ name, type, size })),
    };

    setMessages((prev) => [...prev, userMsg]);

    if (firebaseBackend.isAvailable() && currentConversationId && currentConversationId !== 'local') {
      try {
        await firebaseBackend.saveMessage(userMsg);
        await firebaseBackend.trackEvent('message_sent', { length: userMessage.length });
      } catch (error) {
        console.warn('Error saving user message:', error);
        setHistoryStatus('Could not save your message to the cloud. Check your connection.');
      }
    }

    void captureLifeRadar(userMessage);

    setIsLoading(true);

    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Authentication required');

      // Retrieve relevant account-scoped history. Date questions use message timestamps,
      // not only the conversation's last-updated date or keyword similarity.
      let recentConversationContext = '';
      if (memoryEnabled && firebaseBackend.isAvailable()) {
        try {
          const isRecallRequest = /remember|recollect|recall|yesterday|last (?:chat|time|week)|previous (?:chat|conversation)|we (?:talked|discussed)|what did we/i.test(userMessage);
          const asksYesterday = /yesterday/i.test(userMessage);
          const now = new Date();
          const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          const previous = (await firebaseBackend.getConversations(isRecallRequest ? 40 : 4))
            .filter((conversation) => conversation.id !== currentConversationId)
            .filter((conversation) => !asksYesterday ||
              (conversation.createdAt < todayStart && conversation.updatedAt >= yesterdayStart))
            .slice(0, isRecallRequest ? MAX_RECALL_CONVERSATIONS : 3);
          const keywords = recallKeywords(userMessage);
          const candidates = await Promise.all(previous.map(async (conversation, index) => {
            const messageLimit = isRecallRequest ? MAX_RECALL_MESSAGES_PER_CONVERSATION : 120;
            const allSaved = (await firebaseBackend.getMessages(conversation.id, messageLimit))
              .filter((item) => item.role === 'user' || item.role === 'assistant');
            const saved = asksYesterday
              ? allSaved.filter((item) => item.timestamp >= yesterdayStart && item.timestamp < todayStart)
              : allSaved;
            const compacted = compactConversationMessages(saved, keywords, asksYesterday ? 18 : 14);
            const content = compacted.map((item) =>
              '[' + localDateKey(new Date(item.timestamp)) + '] ' + item.role + ': ' + item.content
            ).join('\n');
            const searchable = (conversation.title + '\n' +
              saved.map((item) => item.content.slice(0, 1800)).join('\n')).toLowerCase();
            const relevance = keywords.reduce((sum, word) => sum + (searchable.includes(word) ? 10 : 0), 0);
            return {
              conversation,
              content,
              relevance,
              index,
              savedCount: saved.length,
              compactedCount: compacted.length,
              retrievalCapped: allSaved.length >= messageLimit,
            };
          }));
          const matching = candidates.filter((item) => item.savedCount > 0);
          if (!asksYesterday) {
            matching.sort((a, b) => b.relevance - a.relevance || a.index - b.index);
          } else {
            matching.sort((a, b) => a.conversation.createdAt - b.conversation.createdAt);
          }
          let remaining = MAX_PRIOR_CONTEXT_CHARS;
          const selected: string[] = [];
          let included = 0;
          for (const candidate of matching.slice(0, isRecallRequest ? 8 : 2)) {
            if (!candidate.content || remaining < 500) break;
            const heading = 'Saved conversation: ' + candidate.conversation.title + ' (' +
              new Date(candidate.conversation.updatedAt).toLocaleDateString() +
              ', ' + candidate.savedCount + ' matching saved messages' +
              (asksYesterday ? ' from yesterday' : '') + '):\n';
            const available = Math.max(0, remaining - heading.length - 180);
            if (available < 300) break;
            const omitted = candidate.compactedCount < candidate.savedCount ||
              candidate.content.length > available ||
              candidate.retrievalCapped;
            const excerpt = candidate.content.length > available
              ? candidate.content.slice(-available)
              : candidate.content;
            selected.push(heading + (omitted
              ? '[Compact excerpt selected for relevance and timeline coverage; some messages are omitted.]\n'
              : '[Complete set of matching messages retrieved for this excerpt.]\n') + excerpt);
            included++;
            remaining -= selected[selected.length - 1].length;
          }
          const dateLabel = asksYesterday
            ? 'Yesterday is ' + localDateKey(new Date(yesterdayStart)) + ' in the user local time zone. '
            : '';
          const coverage = 'Retrieved compact excerpts from ' + included + ' of ' + matching.length +
            ' matching saved conversations' +
            (asksYesterday ? ' containing messages dated yesterday' : '') +
            '. The search checks up to 40 recent conversations and compresses long chats before sending them to the model. ' +
            (included < matching.length ? 'Some conversations were omitted due to context limits. ' : '') +
            'Do not claim that this is every conversation the user ever had.\n';
          recentConversationContext = dateLabel + coverage + selected.join('\n\n');
        } catch (error) {
          console.warn('Could not retrieve older conversation context:', error);
          setHistoryStatus('Previous conversations could not be retrieved. Your current chat still works.');
        }
      }

      const chatContext = memoryEnabled ? currentChatContext(messages) : { selected: [], omitted: 0 };
      // Preserve local calendar dates for messages in the currently open conversation.
      // Without dates, a "yesterday" question can confuse today's and yesterday's messages.
      const datedChatHistory = chatContext.selected.map((item, index) => {
        const eligible = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
        const original = eligible[eligible.length - chatContext.selected.length + index];
        return { role: item.role, content: original
          ? '[' + localDateKey(new Date(original.timestamp)) + '] ' + item.content
          : item.content };
      });

      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message: userMessage,
          businessContext,
          chatbotName,
          responseStyle,
          memoryEnabled,
          persistentMemory: memoryEnabled ? persistentMemory : [],
          recentConversationContext: memoryEnabled ? recentConversationContext : '',
          attachments: outgoingAttachments.map(({ name, type, size, dataUrl }) => ({
            name,
            type,
            size,
            dataUrl,
          })),
          history: datedChatHistory,
          omittedCurrentMessages: chatContext.omitted,
          localDate: localDateKey(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        }),
      });

      if (!apiResponse.ok) {
        const failure = await apiResponse.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(failure?.message || failure?.error || `Chat API error: ${apiResponse.status}`);
      }

      const data = (await apiResponse.json()) as ChatApiResponse;

      const response =
        data.message || "I received your message, but I couldn't generate a response.";

      if (data.githubReviewStatus) {
        setHistoryStatus(data.githubReviewStatus);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        userId: 'ai-assistant',
        conversationId: currentConversationId || 'local',
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (firebaseBackend.isAvailable() && currentConversationId && currentConversationId !== 'local') {
        try {
          await firebaseBackend.saveMessage(assistantMsg);
        } catch (error) {
          console.warn('Error saving assistant message:', error);
          setHistoryStatus('The reply appeared, but could not be saved to your account.');
        }
      }

      if (data.type && data.type !== 'chat') {
        setPendingAction(data);
      } else {
        setPendingAction(null);
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        userId: 'system',
        conversationId: currentConversationId || 'local',
        role: 'assistant',
        content: `I encountered an error processing your request. ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, attachments, isLoading, currentConversationId, businessContext, chatbotName, responseStyle, memoryEnabled, persistentMemory, messages, userId, captureLifeRadar]);

  useEffect(() => {
    if (!queuedLaunch || !input.trim() || isLoading) return;

    setQueuedLaunch(false);
    handleSendMessage();
  }, [queuedLaunch, input, isLoading, handleSendMessage]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveName = async () => {
    const trimmedName = nameInput.trim() || DEFAULT_ASSISTANT_NAME;
    setChatbotName(trimmedName);
    localStorage.setItem('chatbot_name:' + userId, trimmedName);

    try {
      const existing = await firebaseBackend.getLatestDraft('assistant-preferences');
      await firebaseBackend.saveDraft('assistant-preferences', {
        ...(existing || {}),
        assistantName: trimmedName,
        tone: responseStyle,
        memoryEnabled,
        updatedAt: Date.now(),
      });
    } catch {
      // The visible name still updates locally if cloud preference sync fails.
    }

    setIsEditingName(false);
  };

  if (!isInitialized) {
    return (
      <div className={`advanced-chat ${fullScreen ? 'fullscreen' : 'floating'}`}>
        <div className="chat-header">
          <div className="header-left">
            <h2>Life&apos;s Assistant</h2>
            <p>Loading...</p>
          </div>
          {fullScreen && onClose && (
            <button className="dashboard-back-btn" onClick={onClose}>
              <span aria-hidden="true">←</span>
              <span>Dashboard</span>
            </button>
          )}
        </div>

        <div className="chat-main loading-center">
          <p>Initializing chat...</p>
        </div>

        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className={`advanced-chat ${fullScreen ? 'fullscreen' : 'floating'}`}>
      <div className="chat-header">
        <div className="header-left">
          <div className="bot-name-row">
            {isEditingName ? (
              <div className="name-editor">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  maxLength={30}
                />
                <button onClick={handleSaveName}>Save</button>
              </div>
            ) : (
              <>
                <h2>{chatbotName}</h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="edit-name-btn"
                  title="Edit assistant name"
                >
                  ✎
                </button>
              </>
            )}
          </div>

          <p>Ask anything. Draft, plan, organize, and get work moving.</p>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="history-toggle-btn"
            aria-expanded={historyOpen}
            onClick={() => {
              setHistoryOpen((open) => !open);
              setConversationLoadError('');
            }}
          >
            {historyOpen ? 'Close history' : 'History (' + conversations.length + ')'}
          </button>
          {fullScreen && onClose ? (
            <button type="button" className="dashboard-back-btn" onClick={onClose}>
              <span aria-hidden="true">←</span>
              <span>Dashboard</span>
            </button>
          ) : (
            onClose && (
              <button className="close-btn" onClick={onClose}>
                ✕
              </button>
            )
          )}
        </div>
      </div>

      {historyStatus && (
        <div className="chat-history-status" role="status">{historyStatus}</div>
      )}

      {historyOpen && (
        <section className="history-browser" aria-label="Saved conversations">
          <div className="history-browser-heading">
            <div>
              <strong>Saved conversations</strong>
              <p>Select a conversation to open its saved messages.</p>
            </div>
            <button type="button" className="new-chat-btn" onClick={createNewConversation}>
              + New chat
            </button>
          </div>
          {conversationLoadError && (
            <p className="history-error" role="alert">{conversationLoadError}</p>
          )}
          {conversations.length === 0 ? (
            <p className="history-empty">No saved conversations found for this account.</p>
          ) : (
            <div className="history-list">
              {conversations.map((conv) => (
                <button
                  type="button"
                  key={conv.id}
                  disabled={Boolean(loadingConversationId)}
                  className={`history-item ${conv.id === currentConversationId ? 'active' : ''}`}
                  onClick={() => void loadConversation(conv.id)}
                >
                  <span className="history-item-main">
                    <strong>{conv.title || 'Untitled conversation'}</strong>
                    <small>{new Date(conv.updatedAt || conv.createdAt).toLocaleString()} · {conv.messageCount || 0} saved messages</small>
                  </span>
                  <span className="history-item-open">
                    {loadingConversationId === conv.id ? 'Opening…' : 'Open →'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="chat-main" style={historyOpen ? { display: 'none' } : undefined}>
        <div className="messages-wrapper">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>Welcome 👋</h3>
                <p>Ask anything, attach a file, or take a photo to identify, cook, clean, troubleshoot, or plan.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message message-${msg.role}`}>
                  <div className="message-bubble">
                    {msg.content.split('\n').map((line, idx) => (
                      <div key={idx}>{line}</div>
                    ))}
                    {msg.attachments?.length ? (
                      <div className="message-attachments">
                        {msg.attachments.map((attachment, index) => (
                          <span className="message-attachment" key={attachment.name + '-' + index}>
                            📎 {attachment.name}
                            <small>{formatFileSize(attachment.size)}</small>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="message message-assistant">
                <div className="message-bubble typing">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {pendingAction && pendingAction.type && pendingAction.type !== 'chat' && (
          <div className="action-card">
            <div className="action-mark">
              {pendingAction.type === 'quote' ? '▤' : pendingAction.type === 'email' ? '↗' : '✓'}
            </div>
            <div className="action-copy">
              <strong>
                {pendingAction.type === 'quote'
                  ? 'Open this as a quote'
                  : pendingAction.type === 'email'
                    ? 'Open this as an email draft'
                    : 'Save this as a task'}
              </strong>
              <small>
                The conversation stays here until you choose to move the draft into the workspace.
              </small>
            </div>
            <div className="action-buttons">
              <button
                type="button"
                className="action-dismiss"
                onClick={() => setPendingAction(null)}
              >
                Not now
              </button>
              <button
                type="button"
                className="action-open"
                onClick={() => {
                  handleToolHandoff(pendingAction);
                  setPendingAction(null);
                }}
              >
                Open
              </button>
            </div>
          </div>
        )}

        <div className="input-area">
          {attachments.length > 0 && (
            <div className="pending-attachments">
              {attachments.map((attachment) => (
                <div className="pending-attachment" key={attachment.id}>
                  <span>
                    <strong>{attachment.name}</strong>
                    <small>{formatFileSize(attachment.size)}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    title={'Remove ' + attachment.name}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {attachmentError && <p className="attachment-error">{attachmentError}</p>}

          {attachments.some((attachment) => attachment.type.startsWith('image/')) && (
            <div className="photo-actions" aria-label="Photo help shortcuts">
              <button type="button" onClick={() => setInput('What is this? Identify what you can see and tell me what it is used for.')}>
                Identify
              </button>
              <button type="button" onClick={() => setInput('Help me with cooking using what is in this photo. Tell me what you can identify, what I can make, and any food-safety concerns.')}>
                Cooking
              </button>
              <button type="button" onClick={() => setInput('Help me clean what is in this photo. Identify the surface or mess if possible, tell me what is safe to use, and warn me about anything I should not mix.')}>
                Cleaning
              </button>
              <button type="button" onClick={() => setInput('Look at this photo and help me figure out what is going on and what I should do next. If something could be dangerous, tell me before giving steps.')}>
                Help / Fix
              </button>
            </div>
          )}

          <div className="input-wrapper">
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              multiple
              accept=".pdf,.txt,.md,.json,.html,.htm,.xml,.rtf,.odt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.tsv,.iif,.png,.jpg,.jpeg,.webp,.gif,.js,.jsx,.ts,.tsx,.py,.java,.c,.cc,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.kts,.sh,.sql,.yaml,.yml"
              onChange={handleFileSelection}
            />
            <input
              ref={cameraInputRef}
              className="file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelection}
            />
            <button
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              type="button"
              disabled={isLoading}
            >
              📎
            </button>
            <button
              className="camera-btn"
              onClick={() => cameraInputRef.current?.click()}
              title="Take a photo"
              aria-label="Take a photo"
              type="button"
              disabled={isLoading}
            >
              📷
            </button>

            <button
              className={`mic-btn ${isListening ? 'listening' : ''}`}
              onClick={handleToggleMic}
              title={isListening ? 'Stop listening' : 'Start voice input'}
              type="button"
            >
              {isListening ? '🔴' : '🎤'}
            </button>

            <input
              id="message-input"
              name="message-input"
              ref={inputRef}
              type="text"
              placeholder={'Message ' + chatbotName}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              maxLength={2000}
            />

            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={(!input.trim() && !attachments.length) || isLoading}
              type="button"
            >
              ➤
            </button>
          </div>

          <p className="sync-status">
            {firebaseBackend.isAvailable() ? '✓ Syncing across devices' : '📱 Local mode'}
          </p>
        </div>
      </div>

      <style jsx>{styles}</style>
    </div>
  );
};

const styles = `
  .advanced-chat {
    display: flex;
    flex-direction: column;
    background: #212121;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
    z-index: 1000;
  }

  .advanced-chat.floating {
    position: fixed;
    right: 24px;
    bottom: 100px;
    width: 500px;
    max-width: calc(100vw - 32px);
    height: 650px;
    max-height: 80vh;
  }

  .advanced-chat.fullscreen {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  .chat-header {
    background: #212121;
    padding: 0.8rem 1.1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-left h2 {
    margin: 0;
    font-size: 1.1rem;
  }

  .header-left p {
    margin: 0.25rem 0 0;
    opacity: 0.85;
    font-size: 0.85rem;
  }

  .bot-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .edit-name-btn,
  .close-btn {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: white;
    border-radius: 0.4rem;
    padding: 0.3rem 0.5rem;
    cursor: pointer;
  }

  .dashboard-back-btn {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid #3a3a3a;
    border-radius: 10px;
    padding: 0 11px;
    background: #2b2b2b;
    color: #e7e7e7;
    font-size: .72rem;
    font-weight: 650;
    cursor: pointer;
    flex-shrink: 0;
  }

  .dashboard-back-btn:hover {
    background: #343434;
    border-color: #474747;
  }

  .name-editor {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .name-editor input {
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.1);
    color: white;
  }

  .name-editor button {
    padding: 0.3rem 0.5rem;
    border-radius: 0.4rem;
    border: none;
    cursor: pointer;
  }

  .chat-history-status {
    padding: 6px 14px;
    border-bottom: 1px solid #303030;
    color: #a5a5a5;
    font-size: .68rem;
    line-height: 1.3;
  }

  .chat-header-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .history-toggle-btn {
    min-height: 36px;
    border: 1px solid #515151;
    border-radius: 9px;
    padding: 0 11px;
    color: #f5f5f5;
    background: #343434;
    font-size: .75rem;
    font-weight: 650;
    cursor: pointer;
  }
  .history-toggle-btn:hover { background: #444; }
  .history-browser {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 18px;
    background: #202020;
  }
  .history-browser-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .history-browser-heading strong { font-size: 1rem; }
  .history-browser-heading p { margin: 5px 0 0; color: #999; font-size: .76rem; }
  .new-chat-btn {
    border: 1px solid #525252;
    border-radius: 9px;
    padding: 10px 12px;
    background: #343434;
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  .history-list { display: flex; flex-direction: column; gap: 8px; }
  .history-item {
    width: 100%;
    min-height: 66px;
    padding: 12px 14px;
    border: 1px solid #393939;
    border-radius: 12px;
    background: #2a2a2a;
    color: #eee;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }
  .history-item:hover { background: #333; border-color: #555; }
  .history-item.active { border-color: #777; }
  .history-item:disabled { cursor: wait; opacity: .75; }
  .history-item-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .history-item-main strong { overflow-wrap: anywhere; font-size: .85rem; }
  .history-item-main small { color: #aaa; font-size: .7rem; }
  .history-item-open { flex-shrink: 0; font-size: .75rem; color: #ddd; }
  .history-error { color: #ffc1b9; background: #422a2a; border-radius: 8px; padding: 10px; }
  .history-empty { color: #aaa; font-size: .8rem; }

  .chat-main {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .loading-center {
    align-items: center;
    justify-content: center;
  }

  .messages-wrapper {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.25rem 1rem 2rem;
    background: #212121;
  }

  .messages-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .empty-state {
    text-align: center;
    color: rgba(255,255,255,0.75);
    margin-top: 16vh;
  }

  .message {
    display: flex;
  }

  .message-user {
    justify-content: flex-end;
  }

  .message-assistant {
    justify-content: flex-start;
  }

  .message-bubble {
    max-width: 760px;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    word-wrap: break-word;
    line-height: 1.4;
    font-size: 0.9rem;
  }

  .message-user .message-bubble {
    background: #303030;
    color: white;
    border-radius: 18px;
  }

  .message-assistant .message-bubble {
    background: transparent;
    color: #e0e0e0;
    border: none;
    border-radius: 0;
  }

  .message-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 9px;
  }

  .message-attachment {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 6px 8px;
    border-radius: 9px;
    background: #252525;
    border: 1px solid #424242;
    font-size: .7rem;
    overflow-wrap: anywhere;
  }

  .message-attachment small {
    color: #8b8b8b;
    white-space: nowrap;
  }

  .typing {
    display: flex;
    gap: 0.3rem;
  }

  .typing-dot {
    width: 7px;
    height: 7px;
    background: white;
    border-radius: 50%;
    opacity: 0.7;
    animation: pulse 1s infinite ease-in-out;
  }

  .typing-dot:nth-child(2) {
    animation-delay: 0.15s;
  }

  .typing-dot:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes pulse {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(-3px); opacity: 1; }
  }

  .action-card {
    margin: 0 22px 10px;
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) auto;
    gap: 11px;
    align-items: center;
    padding: 11px 12px;
    border: 1px solid #3a3a3a;
    border-radius: 13px;
    background: #282828;
  }

  .action-mark {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #343434;
    color: #ddd;
  }

  .action-copy strong,
  .action-copy small {
    display: block;
  }

  .action-copy strong {
    font-size: .76rem;
  }

  .action-copy small {
    margin-top: 3px;
    color: #747474;
    font-size: .63rem;
    line-height: 1.4;
  }

  .action-buttons {
    display: flex;
    gap: 6px;
  }

  .action-buttons button {
    min-height: 34px;
    padding: 0 10px;
    border-radius: 9px;
    font-size: .66rem;
    font-weight: 650;
    cursor: pointer;
  }

  .action-dismiss {
    border: 1px solid #414141;
    background: transparent;
    color: #999;
  }

  .action-open {
    border: 0;
    background: #ededed;
    color: #111;
  }

  .input-area {
    padding: 1rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    background: #212121;
  }

  .pending-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-bottom: 8px;
  }

  .pending-attachment {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    padding: 7px 8px 7px 10px;
    border: 1px solid #444;
    border-radius: 11px;
    background: #292929;
  }

  .pending-attachment span,
  .pending-attachment strong,
  .pending-attachment small {
    min-width: 0;
  }

  .pending-attachment strong,
  .pending-attachment small {
    display: block;
  }

  .pending-attachment strong {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: .68rem;
  }

  .pending-attachment small {
    margin-top: 2px;
    color: #888;
    font-size: .58rem;
  }

  .pending-attachment button {
    border: 0;
    background: transparent;
    color: #aaa;
    cursor: pointer;
    font-size: 1rem;
  }

  .attachment-error {
    margin: 0 0 8px;
    color: #d69a9a;
    font-size: .68rem;
  }

  .photo-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 8px;
  }

  .photo-actions button {
    min-height: 30px;
    padding: 0 9px;
    border: 1px solid #444;
    border-radius: 999px;
    background: #292929;
    color: #cfcfcf;
    cursor: pointer;
    font-size: .64rem;
  }

  .photo-actions button:hover {
    background: #343434;
  }

  .input-wrapper {
    display: flex;
    gap: 0.5rem;
    background: #2f2f2f;
    border: 1px solid #4a4a4a;
    border-radius: 24px;
    padding: 0.4rem;
  }

  .file-input {
    display: none;
  }

  .input-wrapper input {
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    font-size: 0.9rem;
    padding: 0.5rem 0.75rem;
    outline: none;
  }

  .attach-btn,
  .camera-btn,
  .mic-btn,
  .send-btn {
    border: none;
    color: white;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    cursor: pointer;
    flex-shrink: 0;
  }

  .attach-btn,
  .camera-btn,
  .mic-btn {
    background: rgba(255,255,255,0.1);
  }

  .attach-btn:disabled,
  .camera-btn:disabled {
    opacity: .5;
    cursor: default;
  }

  .mic-btn.listening {
    background: rgba(239, 68, 68, 0.8);
  }

  .send-btn {
    background: #f4f4f4;
    color: #111;
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sync-status {
    margin: 0.5rem 0 0;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.6);
    text-align: center;
  }

  @media (max-width: 768px) {
    .advanced-chat.floating {
      width: calc(100vw - 16px);
      height: calc(100vh - 140px);
      right: 8px;
      bottom: 60px;
    }

    .message-bubble {
      max-width: 90%;
    }

    .chat-header {
      gap: 10px;
      padding: .72rem .8rem;
    }

    .header-left {
      min-width: 0;
    }

    .header-left p {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dashboard-back-btn {
      padding: 0 9px;
    }
  }
`;

export default AdvancedConversationalChat;
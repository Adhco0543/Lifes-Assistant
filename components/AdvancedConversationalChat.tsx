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
  data?: any;
};

type PendingAttachment = ChatAttachmentMeta & {
  id: string;
  dataUrl: string;
};

const MAX_ATTACHMENT_BYTES = 2_400_000;
const MAX_ATTACHMENTS = 3;
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
  const [chatbotName, setChatbotName] = useState("Life's Assistant");
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("Life's Assistant");
  const [isListening, setIsListening] = useState(false);
  const [responseStyle, setResponseStyle] = useState<'concise' | 'balanced' | 'detailed'>('balanced');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [persistentMemory, setPersistentMemory] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<ChatApiResponse | null>(null);
  const [queuedLaunch, setQueuedLaunch] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let active = true;

    const loadPreferences = async () => {
      const savedName = localStorage.getItem('chatbot_name:' + userId);
      if (savedName) {
        setChatbotName(savedName);
        setNameInput(savedName);
      }

      try {
        const cloudPrefs = await firebaseBackend.getLatestDraft('assistant-preferences');
        if (!active || !cloudPrefs) return;

        if (typeof cloudPrefs.assistantName === 'string' && cloudPrefs.assistantName.trim()) {
          setChatbotName(cloudPrefs.assistantName.trim());
          setNameInput(cloudPrefs.assistantName.trim());
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
    try {
      if (!firebaseBackend.isAvailable()) return;

      const msgs = await firebaseBackend.getMessages(conversationId, 100);
      setMessages(msgs);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  }, []);

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
            if (cancelled) return;

            setConversations(convs);

            if (convs.length > 0 && !currentConversationId) {
              loadConversation(convs[0].id);
            }
          });

          const existingConvs = await firebaseBackend.getConversations();
          if (cancelled) return;

          setConversations(existingConvs);

          if (existingConvs.length > 0) {
            await loadConversation(existingConvs[0].id);
          } else {
            const newConvId = await firebaseBackend.createConversation('New Chat', businessContext);
            if (!cancelled) {
              setCurrentConversationId(newConvId);
            }
          }
        } else {
          const welcomeMsg: ChatMessage = {
            id: 'welcome',
            userId: userId || 'local-user',
            conversationId: 'local',
            role: 'assistant',
            content:
              "👋 Hi! I'm Life's Assistant. I can help with everyday planning, work, writing, tasks, reminders, memory, projects, estimates, and turning ideas into finished actions.",
            timestamp: Date.now(),
          };

          setMessages([welcomeMsg]);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);

        const welcomeMsg: ChatMessage = {
          id: 'welcome',
          userId: userId || 'local-user',
          conversationId: 'local',
          role: 'assistant',
          content:
            "👋 Hi! I'm Life's Assistant. I can help organize life and work, remember useful context, draft things, plan projects, and turn conversations into actions.",
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
  }, [userId, businessContext, currentConversationId, loadConversation]);

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
      setCurrentConversationId(newConvId);
      setMessages([]);
      setInput('');
      setAttachments([]);
      setAttachmentError('');
      setPendingAction(null);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }, [businessContext]);

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

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setAttachmentError('');

    const room = Math.max(0, MAX_ATTACHMENTS - attachments.length);
    if (!room) {
      setAttachmentError('You can attach up to ' + MAX_ATTACHMENTS + ' files per message.');
      return;
    }

    const chosen = files.slice(0, room);
    const unsupported = chosen.find((file) => !SUPPORTED_ATTACHMENT_EXTENSIONS.test(file.name));
    if (unsupported) {
      setAttachmentError(unsupported.name + ' is not a supported chat attachment.');
      return;
    }

    const existingBytes = attachments.reduce((sum, item) => sum + item.size, 0);
    const addedBytes = chosen.reduce((sum, file) => sum + file.size, 0);

    if (existingBytes + addedBytes > MAX_ATTACHMENT_BYTES) {
      setAttachmentError('Keep the combined attachments under 2.4 MB for now.');
      return;
    }

    try {
      const next = await Promise.all(
        chosen.map(async (file, index) => ({
          id: Date.now() + '-' + index + '-' + file.name,
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );
      setAttachments((current) => current.concat(next).slice(0, MAX_ATTACHMENTS));
    } catch {
      setAttachmentError('One of those files could not be read. Try it again.');
    }
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
      }
    }

    void captureLifeRadar(userMessage);

    setIsLoading(true);

    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Authentication required');
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
          attachments: outgoingAttachments.map(({ name, type, size, dataUrl }) => ({
            name,
            type,
            size,
            dataUrl,
          })),
          history: memoryEnabled
            ? messages
                .slice(-12)
                .filter((item) => item.role === 'user' || item.role === 'assistant')
                .map((item) => ({ role: item.role, content: item.content }))
            : [],
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`Chat API error: ${apiResponse.status}`);
      }

      const data = (await apiResponse.json()) as ChatApiResponse;

      const response =
        data.message || "I received your message, but I couldn't generate a response.";

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
    const trimmedName = nameInput.trim() || "Life's Assistant";
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

        {!fullScreen && onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {firebaseBackend.isAvailable() && conversations.length > 0 && (
        <div className="conversations-panel">
          <button className="new-chat-btn" onClick={createNewConversation}>
            + New Chat
          </button>

          <div className="conversations-list">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`conversation-item ${
                  conv.id === currentConversationId ? 'active' : ''
                }`}
                onClick={() => loadConversation(conv.id)}
              >
                <span className="conv-title">{conv.title}</span>
                <span className="conv-count">{conv.messageCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-main">
        <div className="messages-wrapper">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>Welcome 👋</h3>
                <p>Ask me to create a quote, draft an email, make a reminder, or plan work.</p>
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

          <div className="input-wrapper">
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              multiple
              accept=".pdf,.txt,.md,.json,.html,.htm,.xml,.rtf,.odt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.tsv,.iif,.png,.jpg,.jpeg,.webp,.gif,.js,.jsx,.ts,.tsx,.py,.java,.c,.cc,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.swift,.kt,.kts,.sh,.sql,.yaml,.yml"
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
              placeholder="Message Life's Assistant"
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

  .conversations-panel {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    overflow-x: auto;
    padding: 0.65rem;
    background: #1f1f1f;
    border-bottom: 1px solid #2f2f2f;
  }

  .new-chat-btn,
  .conversation-item {
    border: none;
    border-radius: 0.5rem;
    padding: 0.45rem 0.7rem;
    background: #2f2f2f;
    color: white;
    cursor: pointer;
    white-space: nowrap;
  }

  .conversation-item.active {
    background: #3a3a3a;
  }

  .conv-count {
    margin-left: 0.4rem;
    opacity: 0.7;
    font-size: 0.75rem;
  }

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
  .mic-btn {
    background: rgba(255,255,255,0.1);
  }

  .attach-btn:disabled {
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
  }
`;

export default AdvancedConversationalChat;
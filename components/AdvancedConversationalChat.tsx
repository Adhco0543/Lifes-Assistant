'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import type { ChatMessage, Conversation } from '../lib/firebaseBackend';

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const savedName = localStorage.getItem('chatbot_name');
    if (savedName) {
      setChatbotName(savedName);
      setNameInput(savedName);
    }
  }, []);

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
              "👋 Hi! I'm Life's Assistant. I can help you create quotes, draft emails, manage customers, write notes, create reminders, estimate materials, and organize business tasks.",
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
            "👋 Hi! I'm Life's Assistant. I can help with quotes, emails, reminders, customers, notes, materials, and business tasks.",
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

  const createNewConversation = async () => {
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
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleToolHandoff = (data: ChatApiResponse) => {
    if (data.type === 'quote') {
      localStorage.setItem('quote_draft', JSON.stringify(data.data || {}));
      window.dispatchEvent(new CustomEvent('open-quote-builder'));
    }

    if (data.type === 'email') {
      localStorage.setItem('email_draft', JSON.stringify(data.data || {}));
      window.dispatchEvent(new CustomEvent('open-email'));
    }

    if (data.type === 'task') {
      localStorage.setItem('task_draft', JSON.stringify(data.data || {}));
      window.dispatchEvent(new CustomEvent('open-tasks'));
    }
  };

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      userId: firebaseBackend.getCurrentUser()?.uid || userId || 'local-user',
      conversationId: currentConversationId || 'local',
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
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

    setIsLoading(true);

    try {
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          businessContext,
          chatbotName,
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

      handleToolHandoff(data);
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
  }, [input, isLoading, currentConversationId, businessContext, chatbotName, userId]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSaveName = () => {
    const trimmedName = nameInput.trim() || "Life's Assistant";
    setChatbotName(trimmedName);
    localStorage.setItem('chatbot_name', trimmedName);
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

          <p>Business assistant with chat-to-action support</p>
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

        <div className="input-area">
          <div className="input-wrapper">
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
              placeholder="Type or use microphone..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
              maxLength={2000}
            />

            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
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
    background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    border-radius: 0.75rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
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
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  }

  .chat-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 1rem 1.5rem;
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
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.08);
  }

  .new-chat-btn,
  .conversation-item {
    border: none;
    border-radius: 0.5rem;
    padding: 0.45rem 0.7rem;
    background: rgba(255,255,255,0.08);
    color: white;
    cursor: pointer;
    white-space: nowrap;
  }

  .conversation-item.active {
    background: rgba(102, 126, 234, 0.6);
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
    padding: 1rem;
    background: linear-gradient(180deg, rgba(15, 15, 30, 0.8) 0%, rgba(26, 26, 46, 0.9) 100%);
  }

  .messages-container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .empty-state {
    text-align: center;
    color: rgba(255,255,255,0.75);
    margin-top: 3rem;
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
    max-width: 80%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    word-wrap: break-word;
    line-height: 1.4;
    font-size: 0.9rem;
  }

  .message-user .message-bubble {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 0.75rem 0.2rem 0.75rem 0.75rem;
  }

  .message-assistant .message-bubble {
    background: rgba(255, 255, 255, 0.08);
    color: #e0e0e0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.2rem 0.75rem 0.75rem 0.75rem;
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

  .input-area {
    padding: 1rem;
    border-top: 1px solid rgba(255,255,255,0.08);
    background: rgba(15, 15, 30, 0.95);
  }

  .input-wrapper {
    display: flex;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.3);
    border-radius: 1.5rem;
    padding: 0.4rem;
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

  .mic-btn {
    background: rgba(255,255,255,0.1);
  }

  .mic-btn.listening {
    background: rgba(239, 68, 68, 0.8);
  }

  .send-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
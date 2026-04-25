'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { realAI } from '../lib/realAI';
import { firebaseBackend } from '../lib/firebaseBackend';
import { intelligenceEngine, type BusinessInsight } from '../lib/intelligenceEngine';
import type { ChatMessage, Conversation } from '../lib/firebaseBackend';

interface AdvancedChatProps {
  userId?: string;
  businessContext?: string;
  onClose?: () => void;
  fullScreen?: boolean;
}

export const AdvancedConversationalChat: React.FC<AdvancedChatProps> = ({
  userId,
  businessContext,
  onClose,
  fullScreen = false,
}) => {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('');
  const [insights, setInsights] = useState<BusinessInsight[]>([]);
  const [showInsights, setShowInsights] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [chatbotName, setChatbotName] = useState('AI Assistant');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('AI Assistant');
  const [isListening, setIsListening] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load chatbot name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('chatbot_name');
    if (savedName) {
      setChatbotName(savedName);
      setNameInput(savedName);
    }
  }, []);

  // Initialize Firebase and real-time sync
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeChat = async () => {
      try {
        console.log('[Chat] Initializing chat for userId:', userId);
        await firebaseBackend.initialize();

        const currentUser = firebaseBackend.getCurrentUser();

        if (firebaseBackend.isAvailable() && currentUser) {
          unsubscribe = firebaseBackend.onConversationsChange((convs) => {
            setConversations(convs);
            if (convs.length > 0 && !currentConversationId) {
              loadConversation(convs[0].id);
            }
          });

          const existingConvs = await firebaseBackend.getConversations();
          setConversations(existingConvs);

          if (existingConvs.length > 0) {
            await loadConversation(existingConvs[0].id);
          } else {
            const newConvId = await firebaseBackend.createConversation(
              'New Chat',
              businessContext
            );
            setCurrentConversationId(newConvId);
          }
        } else {
          // Fallback to local storage
          realAI.loadConversationHistory();
          const history = realAI.getConversationHistory();

          if (history.length > 0) {
            setMessages(
              history.map((msg, idx) => ({
                id: `local-${idx}`,
                userId: 'local-user',
                conversationId: 'local',
                role: msg.role,
                content: msg.content,
                timestamp: Date.now() - (history.length - idx) * 1000,
              }))
            );
          } else {
            const welcomeMsg: ChatMessage = {
              id: 'welcome',
              userId: 'local-user',
              conversationId: 'local',
              role: 'assistant',
              content: `👋 Hi! I'm your business assistant. Tell me about what you're working on—any business, any challenge—and I'll help you figure it out.`,
              timestamp: Date.now(),
            };
            setMessages([welcomeMsg]);
          }
        }

        setIsInitialized(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch (error) {
        console.error('Error initializing chat:', error);
        setIsInitialized(true);
      }
    };

    initializeChat();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Generate insights
  useEffect(() => {
    if (messages.length > 5) {
      const newInsights = intelligenceEngine.analyzeConversations(messages, conversations);
      setInsights(newInsights.slice(0, 3));
    }
  }, [messages, conversations]);

  // Initialize voice recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setInput((prev) => prev + transcript + ' ');
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  // Toggle microphone
  const handleToggleMic = () => {
    if (!recognitionRef.current) {
      alert('Voice input is not supported in your browser. Please use Chrome, Edge, or Safari.');
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

  // Load conversation
  const loadConversation = async (conversationId: string) => {
    try {
      if (firebaseBackend.isAvailable()) {
        const msgs = await firebaseBackend.getMessages(conversationId, 100);
        setMessages(msgs);
        setCurrentConversationId(conversationId);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

  // Create new conversation
  const createNewConversation = async () => {
    try {
      const title = `Chat ${new Date().toLocaleDateString()}`;
      const newConvId = await firebaseBackend.createConversation(title, businessContext);
      setCurrentConversationId(newConvId);
      setMessages([]);
      setInput('');
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) {
      return;
    }

    const userMessage = input.trim();
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      userId: firebaseBackend.getCurrentUser()?.uid || 'local-user',
      conversationId: currentConversationId || 'local',
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // Save to Firebase
    if (firebaseBackend.isAvailable() && currentConversationId) {
      try {
        await firebaseBackend.saveMessage(userMsg);
        await firebaseBackend.trackEvent('message_sent', { length: userMessage.length });
      } catch (error) {
        console.warn('Error saving message to Firebase:', error);
      }
    }

    // Get AI response
    setIsLoading(true);
    try {
      console.log('[Chat] Sending message:', userMessage);
      const response = await realAI.sendMessage(userMessage, businessContext, chatbotName);
      console.log('[Chat] Got response:', response ? response.substring(0, 50) : 'EMPTY');

      if (!response || response.trim() === '') {
        throw new Error('Empty response from AI service');
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

      if (firebaseBackend.isAvailable() && currentConversationId) {
        try {
          await firebaseBackend.saveMessage(assistantMsg);
        } catch (error) {
          console.warn('Error saving assistant message:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleSendMessage:', error);

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        userId: 'system',
        conversationId: currentConversationId || 'local',
        role: 'assistant',
        content: `I encountered an error processing your request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, isInitialized, currentConversationId, businessContext, chatbotName]);

  // Search messages
  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setSearchTerm('');
      return;
    }

    setIsSearching(true);
    try {
      if (firebaseBackend.isAvailable()) {
        const results = await firebaseBackend.searchMessages(term);
        setMessages(results);
        setSearchTerm(term);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Save name
  const handleSaveName = () => {
    const trimmedName = nameInput.trim() || 'AI Assistant';
    setChatbotName(trimmedName);
    localStorage.setItem('chatbot_name', trimmedName);
    setIsEditingName(false);
  };

  // Loading state
  if (!isInitialized) {
    return (
      <div className={`advanced-chat ${fullScreen ? 'fullscreen' : 'floating'}`}>
        <div className="chat-header">
          <div className="header-left">
            <h2>Business AI Assistant</h2>
            <p>Loading...</p>
          </div>
        </div>
        <div className="chat-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
          <div style={{ textAlign: 'center', color: '#999' }}>
            <p>Initializing chat...</p>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className={`advanced-chat ${fullScreen ? 'fullscreen' : 'floating'}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isEditingName ? (
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  maxLength={30}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '0.95rem',
                    width: '150px',
                  }}
                />
                <button
                  onClick={handleSaveName}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Save
                </button>
              </div>
            ) : (
              <>
                <h2>{chatbotName}</h2>
                <button
                  onClick={() => setIsEditingName(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: '0.25rem',
                    marginLeft: '0.25rem',
                  }}
                  title="Edit bot name"
                >
                  ✎
                </button>
              </>
            )}
          </div>
          <p>With Real-Time Sync & Intelligence</p>
        </div>
        {!fullScreen && onClose && (
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* Conversations Sidebar */}
      {firebaseBackend.isAvailable() && (
        <div className="conversations-panel">
          <button className="new-chat-btn" onClick={createNewConversation}>
            + New Chat
          </button>
          <div className="conversations-list">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                className={`conversation-item ${conv.id === currentConversationId ? 'active' : ''}`}
                onClick={() => loadConversation(conv.id)}
              >
                <span className="conv-title">{conv.title}</span>
                <span className="conv-count">{conv.messageCount}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="chat-main">
        {/* Messages */}
        <div className="messages-wrapper">
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-state">
                <h3>Welcome! 👋</h3>
                <p>Start a conversation about your business and I'll help you succeed.</p>
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
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area with Microphone */}
        <div className="input-area">
          <div className="input-wrapper">
            <button
              className="mic-btn"
              onClick={handleToggleMic}
              title={isListening ? 'Stop listening' : 'Start voice input'}
              style={{
                background: isListening ? 'rgba(239, 68, 68, 0.8)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'white',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
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
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              maxLength={2000}
            />
            <button
              className="send-btn"
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p className="sync-status">
            {firebaseBackend.isAvailable() ? '✓ Syncing across devices' : '📱 Local storage mode'}
          </p>
        </div>
      </div>

      {/* Inline Styles */}
      <style jsx>{`
        .advanced-chat {
          display: flex;
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

        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .messages-wrapper {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          background: linear-gradient(180deg, rgba(15, 15, 30, 0.8) 0%, rgba(26, 26, 46, 0.9) 100%);
          backdrop-filter: blur(10px);
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

        .send-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s ease;
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
      `}</style>
    </div>
  );
};

export default AdvancedConversationalChat;

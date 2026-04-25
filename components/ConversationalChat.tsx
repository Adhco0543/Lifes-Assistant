'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { realAI } from '../lib/realAI';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ConversationalChatProps {
  businessContext?: string;
  onClose?: () => void;
  fullScreen?: boolean;
}

export const ConversationalChat: React.FC<ConversationalChatProps> = ({ 
  businessContext, 
  onClose, 
  fullScreen = false 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize - load conversation history
  useEffect(() => {
    realAI.loadConversationHistory();
    const history = realAI.getConversationHistory();
    
    if (history.length > 0) {
      setMessages(
        history.map((msg, idx) => ({
          id: `msg-${idx}`,
          role: msg.role,
          content: msg.content,
          timestamp: Date.now() - (history.length - idx) * 1000,
        }))
      );
    } else {
      // Show welcome message for new conversations
      const welcomeMsg: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Hi! I'm your business assistant. Tell me about what you're working on—any business, any challenge—and I'll help you figure it out.

Whether you need to create a quote, calculate costs, plan a project, or just think through a problem, I'm here for you.

What can I help you with today?`,
        timestamp: Date.now(),
      };
      setMessages([welcomeMsg]);
    }

    setIsInitialized(true);
    
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /**
   * Handle sending message
   */
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !isInitialized) {
      return;
    }

    const userMessage = input.trim();
    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Get AI response
    setIsLoading(true);
    try {
      const response = await realAI.sendMessage(userMessage, businessContext);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Error:', error);

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error connecting to the AI. ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, isInitialized, businessContext]);

  /**
   * Handle key press
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <div className={`conversational-chat ${fullScreen ? 'fullscreen' : 'floating'}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="header-inner">
          <div className="header-title">
            <h2>Business Assistant</h2>
            <p>Powered by AI</p>
          </div>
          {!fullScreen && onClose && (
            <button className="close-btn" onClick={onClose} aria-label="Close chat">
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-wrapper">
        <div className="messages-container">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message message-${msg.role}`}
              style={{
                animation: `messageSlideIn 0.4s ease-out`,
              }}
            >
              <div className="message-bubble">
                <div className="message-content">
                  {msg.content.split('\n').map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message message-assistant" style={{ animation: `messageSlideIn 0.4s ease-out` }}>
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

      {/* Input Area */}
      <div className="input-area">
        <div className="input-wrapper">
          <input
            id="conversational-input"
            name="conversational-input"
            ref={inputRef}
            type="text"
            placeholder="Ask me anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            className="chat-input"
            maxLength={2000}
          />
          <button
            className="send-btn"
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
        <p className="input-hint">Shift + Enter for new line</p>
      </div>

      <style jsx>{`
        .conversational-chat {
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          border-radius: 0.75rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          z-index: 1000;
          position: relative;
        }

        .conversational-chat.floating {
          position: fixed;
          right: 24px;
          bottom: 100px;
          width: 420px;
          max-width: calc(100vw - 32px);
          height: 600px;
          max-height: 75vh;
        }

        .conversational-chat.fullscreen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
        }

        /* Header */
        .chat-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 1rem 1.5rem;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .header-inner {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-title h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .header-title p {
          margin: 0.25rem 0 0;
          font-size: 0.75rem;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1.2rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: rotate(90deg);
        }

        /* Messages */
        .messages-wrapper {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem;
          background: linear-gradient(180deg, rgba(15, 15, 30, 0.8) 0%, rgba(26, 26, 46, 0.9) 100%);
          backdrop-filter: blur(10px);
        }

        .messages-wrapper::-webkit-scrollbar {
          width: 6px;
        }

        .messages-wrapper::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }

        .messages-wrapper::-webkit-scrollbar-thumb {
          background: rgba(102, 126, 234, 0.5);
          border-radius: 3px;
        }

        .messages-wrapper::-webkit-scrollbar-thumb:hover {
          background: rgba(102, 126, 234, 0.8);
        }

        .messages-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .message {
          display: flex;
          animation: messageSlideIn 0.4s ease-out;
        }

        .message-user {
          justify-content: flex-end;
        }

        .message-assistant {
          justify-content: flex-start;
        }

        @keyframes messageSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .message-bubble {
          max-width: 85%;
          padding: 0.875rem 1.125rem;
          border-radius: 1rem;
          word-wrap: break-word;
          line-height: 1.5;
          font-size: 0.95rem;
          animation: bubbleGrow 0.3s ease-out;
        }

        @keyframes bubbleGrow {
          from {
            transform: scale(0.8);
          }
          to {
            transform: scale(1);
          }
        }

        .message-user .message-bubble {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 1rem 0.25rem 1rem 1rem;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
        }

        .message-assistant .message-bubble {
          background: rgba(255, 255, 255, 0.08);
          color: #e0e0e0;
          border-radius: 0.25rem 1rem 1rem 1rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .message-content {
          white-space: pre-wrap;
        }

        .message-content div {
          display: block;
          margin: 0.25rem 0;
        }

        .message-content div:first-child {
          margin-top: 0;
        }

        .message-content div:last-child {
          margin-bottom: 0;
        }

        /* Typing animation */
        .typing {
          display: flex;
          gap: 0.4rem;
          padding: 0.75rem 1rem;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.6);
          animation: typingBounce 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingBounce {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-10px);
          }
        }

        /* Input Area */
        .input-area {
          padding: 1.25rem 1.5rem;
          background: linear-gradient(180deg, rgba(15, 15, 30, 0.5) 0%, rgba(10, 10, 20, 0.8) 100%);
          border-top: 1px solid rgba(102, 126, 234, 0.2);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .input-wrapper {
          display: flex;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(102, 126, 234, 0.3);
          border-radius: 2rem;
          padding: 0.5rem;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
        }

        .input-wrapper:focus-within {
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          background: rgba(255, 255, 255, 0.08);
        }

        .chat-input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 0.95rem;
          padding: 0.75rem 0.5rem;
          outline: none;
          font-family: inherit;
        }

        .chat-input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .chat-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .send-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .send-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .send-btn svg {
          width: 18px;
          height: 18px;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .input-hint {
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
          margin: 0;
          text-align: center;
        }

        /* Responsive */
        @media (max-width: 640px) {
          .conversational-chat.floating {
            width: calc(100vw - 16px);
            height: calc(100vh - 140px);
            right: 8px;
            bottom: 60px;
            max-height: none;
          }

          .message-bubble {
            max-width: 90%;
            font-size: 0.9rem;
          }

          .chat-header {
            padding: 0.875rem 1rem;
          }

          .messages-wrapper {
            padding: 1rem;
          }

          .input-area {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
};

export default ConversationalChat;

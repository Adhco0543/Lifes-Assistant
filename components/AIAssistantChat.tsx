'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppIntegration, useResponsive } from '../lib/hooks';
import { aiAssistant, Message } from '../lib/aiAssistant';
import { businessProfileManager, BusinessProfile } from '../lib/businessProfile';
import { RichMedia } from './Richmedia';

interface AIAssistantChatProps {
  userId: string;
  onClose?: () => void;
  floatingMode?: boolean; // New: allows floating panel mode
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({ userId, onClose, floatingMode = true }) => {
  const { isMobile } = useResponsive();
  const integration = useAppIntegration(userId);

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const profile = businessProfileManager.loadProfile(userId);
    if (profile) {
      setBusinessProfile(profile);
      aiAssistant.initializeContext(profile);
      setIsInitialized(true);

      // Load conversation history
      const history = aiAssistant.getConversationHistory(50);
      setMessages(history);

      // Set initial suggestions based on context
      if (history.length === 0) {
        setSuggestions([
          'Create a quote',
          'Calculate materials',
          'Help me with a project',
          'Save a note',
        ]);
      } else {
        setSuggestions([
          'More suggestions',
          'Create quote',
          'Save note',
          'Help with calculations',
        ]);
      }
    }
  }, [userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /**
   * Handle sending message - fully interactive, non-blocking
   */
  const handleSendMessage = useCallback(async () => {
    if (!userInput.trim() || !businessProfile || isLoading) {
      return;
    }

    const messageText = userInput.trim();
    setUserInput('');

    try {
      // Add user message to UI immediately
      const userMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: messageText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Track interaction (non-blocking)
      integration.trackUserAction('assistant_message', 'ai_assistant', {
        messageLength: messageText.length,
      });

      // Get AI response (with loading indicator)
      setIsLoading(true);
      const aiResponse = await aiAssistant.processMessage(messageText, userId);
      setIsLoading(false);

      // Add assistant message
      const assistantMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: aiResponse.message,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update suggestions
      setSuggestions(aiResponse.suggestions);

      // Track suggestion actions (non-blocking)
      if (aiResponse.actions.length > 0) {
        integration.trackUserAction('ai_response_received', 'ai_assistant', {
          actions: aiResponse.actions,
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
      setIsLoading(false);
      
      const errorMsg: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had a small issue. Could you rephrase that?',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [userInput, businessProfile, isLoading, userId, integration]);

  if (!isInitialized || !businessProfile) {
    return null;
  }

  // Floating mode: sidebar that doesn't block dashboard
  if (floatingMode && !isOpen) {
    return (
      <button
        className="assistant-fab"
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
      >
        <RichMedia icon="settings" size="md" />
      </button>
    );
  }

  return (
    <div className={`ai-assistant-chat ${floatingMode ? 'floating' : 'fullscreen'} ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Header */}
      <div className="chat-header">
        <div className="header-content">
          <div className="header-text">
            <h2>AI Assistant</h2>
            <p>{businessProfile.businessType}</p>
          </div>
          {floatingMode && (
            <button
              className="close-button"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Welcome! 👋</h3>
            <p>
              I can help with quotes, materials, projects, notes, and more.
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', opacity: 0.7 }}>
              Just ask me anything!
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-bubble">
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message assistant">
            <div className="message-bubble typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !isLoading && (
        <div className="suggestions-container">
          <div className="suggestions-list">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                className="suggestion-button"
                onClick={() => {
                  setUserInput(suggestion);
                  // Auto-send after a brief delay so user can see what was typed
                  setTimeout(() => {
                    if (suggestion === userInput) {
                      handleSendMessage();
                    }
                  }, 50);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="input-container">
        <input
          id="chat-input"
          name="chat-input"
          type="text"
          placeholder="Type your question..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          disabled={isLoading}
          className="chat-input"
        />
        <button
          className="send-button"
          onClick={handleSendMessage}
          disabled={isLoading || !userInput.trim()}
        >
          {isLoading ? '...' : '→'}
        </button>
      </div>

      <style jsx>{`
        .ai-assistant-chat {
          display: flex;
          flex-direction: column;
          background: white;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          border-radius: 0.75rem;
          overflow: hidden;
          font-family: inherit;
          z-index: 1000;
        }

        /* Floating mode - sidebar panel */
        .ai-assistant-chat.floating {
          position: fixed;
          right: 20px;
          bottom: 80px;
          width: 380px;
          height: 600px;
          max-height: 85vh;
          animation: slideUp 0.3s ease-out;
        }

        .ai-assistant-chat.floating.mobile {
          width: calc(100vw - 20px);
          height: calc(100vh - 140px);
          right: 10px;
          bottom: 60px;
        }

        /* Fullscreen mode - takes entire view */
        .ai-assistant-chat.fullscreen {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          border-radius: 0;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chat-header {
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        .header-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
        }

        .header-text h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
        }

        .header-text p {
          margin: 0.2rem 0 0;
          opacity: 0.9;
          font-size: 0.8rem;
        }

        .close-button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-button:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .messages-container::-webkit-scrollbar {
          width: 6px;
        }

        .messages-container::-webkit-scrollbar-track {
          background: #f1f1f1;
        }

        .messages-container::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 3px;
        }

        .messages-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #999;
          flex: 1;
          padding: 1rem;
        }

        .empty-state h3 {
          color: #333;
          margin: 0 0 0.5rem;
          font-size: 1rem;
        }

        .empty-state p {
          margin: 0.25rem 0;
          font-size: 0.85rem;
          line-height: 1.4;
        }

        .message {
          display: flex;
          animation: messageFadeIn 0.2s ease-out;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.assistant {
          justify-content: flex-start;
        }

        @keyframes messageFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message-bubble {
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          max-width: 85%;
          word-wrap: break-word;
          line-height: 1.4;
          font-size: 0.95rem;
        }

        .message.user .message-bubble {
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
          border-bottom-right-radius: 0.15rem;
        }

        .message.assistant .message-bubble {
          background: #f0f0f0;
          color: #333;
          border-bottom-left-radius: 0.15rem;
        }

        .message.assistant .message-bubble.typing {
          padding: 0.75rem 0.9rem;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .message.assistant .message-bubble.typing span {
          width: 6px;
          height: 6px;
          background: #999;
          border-radius: 50%;
          animation: typingPulse 1.4s infinite;
        }

        .message.assistant .message-bubble.typing span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .message.assistant .message-bubble.typing span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typingPulse {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-8px);
          }
        }

        .suggestions-container {
          padding: 0.75rem 1rem;
          border-top: 1px solid #f0f0f0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .suggestions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .suggestion-button {
          padding: 0.45rem 0.8rem;
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 0.5rem;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .suggestion-button:hover {
          background: #4171ff;
          color: white;
          border-color: #4171ff;
          transform: translateY(-1px);
        }

        .input-container {
          padding: 0.875rem 1rem;
          border-top: 1px solid #f0f0f0;
          display: flex;
          gap: 0.5rem;
          background: #fafafa;
          flex-shrink: 0;
        }

        .chat-input {
          flex: 1;
          padding: 0.6rem 0.75rem;
          border: 1px solid #d0d0d0;
          border-radius: 0.4rem;
          font-size: 0.9rem;
          font-family: inherit;
          transition: all 0.2s ease;
        }

        .chat-input:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 2px rgba(65, 113, 255, 0.1);
        }

        .chat-input:disabled {
          background-color: #f0f0f0;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .send-button {
          padding: 0.6rem 1rem;
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
          border: none;
          border-radius: 0.4rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 1rem;
          min-width: 40px;
        }

        .send-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(65, 113, 255, 0.3);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* FAB button when closed */
        .assistant-fab {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4171ff 0%, #00d4ff 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.4);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          z-index: 999;
          animation: fabBounce 0.6s ease-out;
        }

        .assistant-fab:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(65, 113, 255, 0.5);
        }

        @keyframes fabBounce {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @media (max-width: 640px) {
          .ai-assistant-chat.floating {
            width: calc(100vw - 16px);
            height: calc(100vh - 140px);
            right: 8px;
            bottom: 60px;
            max-height: none;
          }

          .chat-header {
            padding: 0.875rem 1rem;
          }

          .header-text h2 {
            font-size: 1rem;
          }

          .messages-container {
            padding: 0.75rem;
          }

          .message-bubble {
            max-width: 90%;
            font-size: 0.9rem;
          }

          .suggestions-list {
            gap: 0.3rem;
          }

          .suggestion-button {
            padding: 0.4rem 0.7rem;
            font-size: 0.75rem;
          }

          .input-container {
            padding: 0.75rem 0.875rem;
          }

          .assistant-fab {
            width: 48px;
            height: 48px;
            right: 12px;
            bottom: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default AIAssistantChat;

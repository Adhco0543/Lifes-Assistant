'use client';

import React from 'react';
import type { ChatMessage } from '../lib/firebaseBackend';
import { formatFileSize } from '../lib/chatAttachments';

type ChatMessageListProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({ messages, isLoading, endRef }: ChatMessageListProps) {
  return (
    <div className="messages-wrapper">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h3>Welcome 👋</h3>
            <p>Ask anything, attach a file, or take a photo to identify, cook, clean, troubleshoot, or plan.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`message message-${message.role}`}>
              <div className="message-bubble">
                {message.content.split('\n').map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
                {message.attachments?.length ? (
                  <div className="message-attachments">
                    {message.attachments.map((attachment, index) => (
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
          <div className="message message-assistant" role="status" aria-label="Assistant is responding">
            <div className="message-bubble typing">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <style jsx>{`
        .messages-wrapper { flex: 1; min-height: 0; overflow-y: auto; padding: 1.25rem 1rem 2rem; background: #212121; }
        .messages-container { display: flex; flex-direction: column; gap: 1rem; }
        .empty-state { text-align: center; color: rgba(255,255,255,.75); margin: 16vh auto 0; max-width: 420px; }
        .message { display: flex; }
        .message-user { justify-content: flex-end; }
        .message-assistant { justify-content: flex-start; }
        .message-bubble { max-width: 760px; padding: .75rem 1rem; border-radius: .75rem; overflow-wrap: anywhere; line-height: 1.4; font-size: .9rem; }
        .message-user .message-bubble { background: #303030; color: #fff; border-radius: 18px; }
        .message-assistant .message-bubble { background: transparent; color: #e0e0e0; border: none; border-radius: 0; }
        .message-attachments { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
        .message-attachment { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 6px 8px; border-radius: 9px; background: #252525; border: 1px solid #424242; font-size: .7rem; overflow-wrap: anywhere; }
        .message-attachment small { color: #aaa; white-space: nowrap; }
        .typing { display: flex; gap: .3rem; }
        .typing-dot { width: 7px; height: 7px; background: #fff; border-radius: 50%; opacity: .7; animation: pulse 1s infinite ease-in-out; }
        .typing-dot:nth-child(2) { animation-delay: .15s; }
        .typing-dot:nth-child(3) { animation-delay: .3s; }
        @keyframes pulse { 0%, 100% { transform: translateY(0); opacity: .4; } 50% { transform: translateY(-3px); opacity: 1; } }
        @media (max-width: 768px) { .message-bubble { max-width: 90%; } }
      `}</style>
    </div>
  );
}

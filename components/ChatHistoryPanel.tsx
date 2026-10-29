'use client';

import React from 'react';
import type { Conversation } from '../lib/firebaseBackend';

type ChatHistoryPanelProps = {
  conversations: Conversation[];
  currentConversationId: string;
  loadingConversationId: string;
  error: string;
  onNewChat: () => void;
  onOpenConversation: (id: string, title?: string) => void;
};

export function ChatHistoryPanel({
  conversations,
  currentConversationId,
  loadingConversationId,
  error,
  onNewChat,
  onOpenConversation,
}: ChatHistoryPanelProps) {
  return (
    <section className="history-browser" aria-label="Saved conversations">
      <div className="history-browser-heading">
        <div>
          <strong>Saved conversations</strong>
          <p>Select a conversation to open its saved messages.</p>
        </div>
        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          + New chat
        </button>
      </div>
      {error && <p className="history-error" role="alert">{error}</p>}
      {conversations.length === 0 ? (
        <p className="history-empty">No saved conversations found for this account.</p>
      ) : (
        <div className="history-list">
          {conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              disabled={Boolean(loadingConversationId)}
              className={`history-item ${conversation.id === currentConversationId ? 'active' : ''}`}
              onClick={() => onOpenConversation(conversation.id, conversation.title)}
            >
              <span className="history-item-main">
                <strong>{conversation.title || 'Untitled conversation'}</strong>
                <small>
                  {new Date(conversation.updatedAt || conversation.createdAt).toLocaleString()} · {conversation.messageCount || 0} saved messages
                </small>
              </span>
              <span className="history-item-open">
                {loadingConversationId === conversation.id ? 'Opening…' : 'Open →'}
              </span>
            </button>
          ))}
        </div>
      )}
      <style jsx>{`
        .history-browser { flex: 1; min-height: 0; overflow-y: auto; padding: 18px; background: #202020; }
        .history-browser-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .history-browser-heading strong { font-size: 1rem; }
        .history-browser-heading p { margin: 5px 0 0; color: #999; font-size: .76rem; }
        .new-chat-btn { border: 1px solid #525252; border-radius: 9px; padding: 10px 12px; background: #343434; color: #fff; cursor: pointer; white-space: nowrap; }
        .new-chat-btn:hover { background: #444; }
        .history-list { display: flex; flex-direction: column; gap: 8px; }
        .history-item { width: 100%; min-height: 66px; padding: 12px 14px; border: 1px solid #393939; border-radius: 12px; background: #2a2a2a; color: #eee; text-align: left; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .history-item:hover { background: #333; border-color: #555; }
        .history-item.active { border-color: #777; }
        .history-item:disabled { cursor: wait; opacity: .75; }
        .history-item-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .history-item-main strong { overflow-wrap: anywhere; font-size: .85rem; }
        .history-item-main small { color: #aaa; font-size: .7rem; }
        .history-item-open { flex-shrink: 0; font-size: .75rem; color: #ddd; }
        .history-error { color: #ffc1b9; background: #422a2a; border-radius: 8px; padding: 10px; }
        .history-empty { color: #aaa; font-size: .8rem; }
        @media (max-width: 520px) {
          .history-browser { padding: 14px 10px; }
          .history-item { padding: 10px; gap: 8px; }
          .history-item-open { font-size: .68rem; }
        }
      `}</style>
    </section>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useIntelligenceLayer } from "@/lib/useIntelligenceLayer";

interface UnreadItem {
  id: string;
  type: "notification" | "message" | "execution_result";
  title: string;
  preview: string;
  icon: string;
  timestamp: Date;
  read: boolean;
}

interface UnreadItemsPanelProps {
  userId: string;
}

export function UnreadItemsPanel({ userId }: UnreadItemsPanelProps) {
  const [items, setItems] = useState<UnreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { notifications } = useIntelligenceLayer(userId);

  useEffect(() => {
    loadItems();
  }, [userId, notifications]);

  const loadItems = () => {
    try {
      const unread = notifications
        ?.filter((n) => !n.read)
        .map((n) => ({
          id: n.id,
          type: n.type === "action_required" ? "notification" : "execution_result",
          title: n.title,
          preview: n.message.substring(0, 60) + (n.message.length > 60 ? "..." : ""),
          icon: getIconForType(n.type),
          timestamp: n.timestamp,
          read: n.read,
        })) || [];

      setItems(unread.slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error("Error loading items:", error);
      setLoading(false);
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "action_required":
        return "⚠️";
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "info":
        return "ℹ️";
      default:
        return "📬";
    }
  };

  if (loading) {
    return (
      <div className="unread-items-panel">
        <h3>🔔 Unread</h3>
        <p className="loading">Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="unread-items-panel">
        <h3>🔔 Unread</h3>
        <p className="empty">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="unread-items-panel">
      <div className="panel-header">
        <h3>🔔 Unread</h3>
        <span className="badge">{items.length}</span>
      </div>

      <div className="items-list">
        {items.map((item) => (
          <div key={item.id} className="item">
            <div className="item-icon">{item.icon}</div>
            <div className="item-content">
              <div className="item-title">{item.title}</div>
              <div className="item-preview">{item.preview}</div>
              <div className="item-time">
                {formatTime(new Date(item.timestamp))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .unread-items-panel {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .badge {
          background: #ff6b6b;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .loading,
        .empty {
          margin: 0;
          padding: 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .items-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item {
          display: flex;
          gap: 12px;
          padding: 10px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 3px solid #ff6b6b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .item:hover {
          background: #fff5f5;
          border-left-color: #ff5252;
        }

        .item-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .item-content {
          flex: 1;
          min-width: 0;
        }

        .item-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-preview {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-time {
          font-size: 11px;
          color: #999;
        }

        @media (max-width: 768px) {
          .unread-items-panel {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}

function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default UnreadItemsPanel;

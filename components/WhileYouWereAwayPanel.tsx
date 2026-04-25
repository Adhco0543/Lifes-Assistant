"use client";

import React, { useEffect, useState } from "react";
import { useIntelligenceLayer } from "@/lib/useIntelligenceLayer";

interface AwayEvent {
  timestamp: Date;
  type: "task_completed" | "decision_made" | "approval_pending" | "execution_success";
  title: string;
  details: string;
  icon: string;
}

interface WhileYouWereAwayProps {
  userId: string;
}

export function WhileYouWereAwayPanel({ userId }: WhileYouWereAwayProps) {
  const [events, setEvents] = useState<AwayEvent[]>([]);
  const [lastSeenAt, setLastSeenAt] = useState<Date>(new Date());
  const { decisions } = useIntelligenceLayer(userId);

  useEffect(() => {
    loadAwayEvents();
  }, [userId, decisions]);

  const loadAwayEvents = () => {
    try {
      // Get last session time from localStorage
      const stored = localStorage.getItem(`last_session_${userId}`);
      const lastSeen = stored ? new Date(stored) : new Date(Date.now() - 86400000); // 24h ago
      setLastSeenAt(lastSeen);

      // Filter decisions made since user was away
      const recentDecisions = decisions
        ?.filter((d) => new Date(d.timestamp) > lastSeen)
        .slice(0, 6)
        .map((d) => ({
          timestamp: d.timestamp,
          type: d.executed ? ("execution_success" as const) : ("decision_made" as const),
          title: d.action.title || `${d.action.toolName} decision`,
          details: `Confidence: ${Math.round(d.confidence)}%`,
          icon: d.executed ? "✅" : "🧠",
        })) || [];

      setEvents(recentDecisions);

      // Update last session time
      localStorage.setItem(`last_session_${userId}`, new Date().toISOString());
    } catch (error) {
      console.error("Error loading away events:", error);
    }
  };

  if (events.length === 0) {
    return (
      <div className="while-away-panel">
        <h3>👋 While You Were Away</h3>
        <p className="empty">Everything is quiet - no new activity</p>
      </div>
    );
  }

  const timeSince = formatTimeSince(lastSeenAt);

  return (
    <div className="while-away-panel">
      <div className="panel-header">
        <h3>👋 While You Were Away</h3>
        <span className="time-badge">Since {timeSince}</span>
      </div>

      <div className="events-list">
        {events.map((event, idx) => (
          <div key={idx} className="event-item">
            <div className="event-icon">{event.icon}</div>
            <div className="event-content">
              <div className="event-title">{event.title}</div>
              <div className="event-details">{event.details}</div>
            </div>
            <div className="event-time">
              {formatTime(new Date(event.timestamp))}
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .while-away-panel {
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

        .time-badge {
          font-size: 11px;
          color: #999;
          background: #f5f5f5;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .empty {
          margin: 0;
          padding: 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
        }

        .events-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .event-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 3px solid #4caf50;
        }

        .event-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .event-content {
          flex: 1;
          min-width: 0;
        }

        .event-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .event-details {
          font-size: 11px;
          color: #999;
        }

        .event-time {
          font-size: 11px;
          color: #999;
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .panel-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
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

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTimeSince(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (hours < 1) return "less than an hour";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""}`;
  if (days === 1) return "yesterday";
  return `${days} days`;
}

export default WhileYouWereAwayPanel;

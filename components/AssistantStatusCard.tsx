"use client";

import React, { useEffect, useState } from "react";
import { useIntelligenceLayer } from "@/lib/useIntelligenceLayer";

interface StatusData {
  state: "active" | "idle" | "background_mode" | "offline";
  isOnline: boolean;
  isWorking: boolean;
  lastDecisionAt: Date;
  nextCheckIn: Date;
  tasksQueued: number;
  approvalsNeeded: number;
  successRate: number;
}

interface AssistantStatusCardProps {
  userId: string;
}

export function AssistantStatusCard({ userId }: AssistantStatusCardProps) {
  const [status, setStatus] = useState<StatusData>({
    state: "idle",
    isOnline: true,
    isWorking: false,
    lastDecisionAt: new Date(),
    nextCheckIn: new Date(Date.now() + 45000),
    tasksQueued: 0,
    approvalsNeeded: 0,
    successRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const intelligenceLayer = useIntelligenceLayer(userId);
  const { decisions, stats } = intelligenceLayer.decisions;

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [userId, decisions, stats]);

  const updateStatus = () => {
    try {
      const now = new Date();
      const tasksQueued = decisions?.filter((d) => !d.executed).length || 0;
      const approvalsNeeded = decisions?.filter(
        (d) => d.decision?.action?.requiresApproval && !d.executed
      ).length || 0;

      // Determine state
      let state: StatusData["state"] = "idle";
      const isWorking = tasksQueued > 0;
      const isOnline = true; // Could check actual connection

      if (isWorking) {
        state = "active";
      } else if (new Date().getHours() > 18 || new Date().getHours() < 8) {
        state = "background_mode";
      }

      setStatus({
        state,
        isOnline,
        isWorking,
        lastDecisionAt: decisions?.[0]?.timestamp || now,
        nextCheckIn: new Date(now.getTime() + 45000),
        tasksQueued,
        approvalsNeeded,
        successRate: stats?.byStatus?.success
          ? Math.round((stats.byStatus.success / stats.totalExecutions) * 100)
          : 0,
      });

      setLoading(false);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const getStateColor = () => {
    switch (status.state) {
      case "active":
        return "#4caf50"; // Green
      case "idle":
        return "#ffc107"; // Yellow
      case "background_mode":
        return "#2196f3"; // Blue
      case "offline":
        return "#9e9e9e"; // Gray
      default:
        return "#999";
    }
  };

  const getStateLabel = () => {
    switch (status.state) {
      case "active":
        return "🟢 Active";
      case "idle":
        return "🟡 Idle";
      case "background_mode":
        return "🔵 Background Mode";
      case "offline":
        return "⚫ Offline";
      default:
        return "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="status-card loading">
        <p>Loading status...</p>
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="status-header">
        <div className="status-indicator" style={{ backgroundColor: getStateColor() }} />
        <div className="status-info">
          <h3>{getStateLabel()}</h3>
          <p className="status-mode">Background mode {status.state === "background_mode" ? "ON" : "OFF"}</p>
        </div>
      </div>

      <div className="status-details">
        <div className="detail-row">
          <span className="detail-label">Next check-in:</span>
          <span className="detail-value">{formatCountdown(status.nextCheckIn)}</span>
        </div>

        {status.tasksQueued > 0 && (
          <div className="detail-row">
            <span className="detail-label">Tasks queued:</span>
            <span className="detail-value alert">{status.tasksQueued}</span>
          </div>
        )}

        {status.approvalsNeeded > 0 && (
          <div className="detail-row">
            <span className="detail-label">Approvals needed:</span>
            <span className="detail-value alert">{status.approvalsNeeded}</span>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">Last decision:</span>
          <span className="detail-value">{formatTime(status.lastDecisionAt)}</span>
        </div>

        {stats && (
          <div className="detail-row">
            <span className="detail-label">Success rate:</span>
            <span className="detail-value">{status.successRate}%</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .status-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .status-card.loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 140px;
          color: #999;
        }

        .status-header {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }

        .status-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 8px currentColor;
        }

        .status-info h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .status-mode {
          margin: 2px 0 0 0;
          font-size: 12px;
          color: #999;
        }

        .status-details {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 12px;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: #999;
          font-weight: 500;
        }

        .detail-value {
          color: #333;
          font-weight: 600;
        }

        .detail-value.alert {
          color: #ff6b6b;
          background: #fff5f5;
          padding: 2px 6px;
          border-radius: 3px;
        }

        @media (max-width: 768px) {
          .status-card {
            padding: 12px;
          }
        }
      `}</style>
    </div>
  );
}

function formatCountdown(date: Date) {
  const diff = date.getTime() - new Date().getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(diff / 60000);

  if (seconds < 0) return "now";
  if (seconds < 60) return `in ${seconds}s`;
  return `in ${minutes}m`;
}

function formatTime(date: Date) {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export default AssistantStatusCard;

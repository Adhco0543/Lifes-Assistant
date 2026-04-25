"use client";

import React, { useEffect, useState } from "react";
import { useIntelligenceLayer } from "@/lib/useIntelligenceLayer";

interface Task {
  id: string;
  title: string;
  type: "approval" | "awaiting_decision" | "ready_to_execute";
  priority: "high" | "medium" | "low";
  createdAt: Date;
  deadline?: Date;
  source?: string;
}

interface PendingTasksPanelProps {
  userId: string;
}

export function PendingTasksPanel({ userId }: PendingTasksPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const intelligenceLayer = useIntelligenceLayer(userId);
  const decisionData = intelligenceLayer.decisions;

  useEffect(() => {
    loadTasks();
    
    // Set a 5 second timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [userId, decisionData]);

  const loadTasks = () => {
    try {
      // Get pending approvals from decisions
      const decisionList = (decisionData && Array.isArray(decisionData.decisions))
        ? decisionData.decisions
        : [];
      
      const pendingApprovals = decisionList
        .filter((d) => d.action.requiresApproval && !d.approved)
        .map((d) => ({
          id: d.id,
          title: d.action.title || `${d.action.toolName} action`,
          type: "approval" as const,
          priority: d.urgency > 70 ? ("high" as const) : ("medium" as const),
          createdAt: d.timestamp,
          deadline: d.deadline,
          source: d.action.toolName,
        }));

      // Get drafts awaiting review
      const drafts = decisionList
        .filter((d) => d.action.type === "draft" && !d.approved)
        .map((d) => ({
          id: d.id,
          title: `Review: ${d.action.title || "draft"}`,
          type: "awaiting_decision" as const,
          priority: d.urgency > 50 ? ("high" as const) : ("medium" as const),
          createdAt: d.timestamp,
          deadline: d.deadline,
          source: d.action.toolName,
        }));

      const combined = [...pendingApprovals, ...drafts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTasks(combined);
      setLoading(false);
    } catch (error) {
      console.error("Error loading tasks:", error);
      setTasks([]);
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffd93d";
      case "low":
        return "#95e1d3";
      default:
        return "#999";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "approval":
        return "✅";
      case "awaiting_decision":
        return "📝";
      default:
        return "⏳";
    }
  };

  if (loading) {
    return (
      <div className="pending-tasks-panel">
        <h3>📋 Pending Tasks</h3>
        <p className="loading">Loading...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="pending-tasks-panel">
        <h3>📋 Pending Tasks</h3>
        <p className="empty">No pending tasks - you're all caught up! ✨</p>
      </div>
    );
  }

  return (
    <div className="pending-tasks-panel">
      <div className="panel-header">
        <h3>📋 Pending Tasks</h3>
        <span className="badge">{tasks.length}</span>
      </div>

      <div className="tasks-list">
        {tasks.slice(0, 5).map((task) => (
          <div key={task.id} className="task-item">
            <div className="task-icon">{getTypeIcon(task.type)}</div>

            <div className="task-content">
              <div className="task-title">{task.title}</div>
              <div className="task-meta">
                {task.source && <span className="source">{task.source}</span>}
                {task.deadline && (
                  <span className="deadline">
                    Due: {new Date(task.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <div
              className="task-priority"
              style={{ backgroundColor: getPriorityColor(task.priority) }}
            >
              {task.priority[0].toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {tasks.length > 5 && (
        <button className="view-all-btn">View all {tasks.length} tasks →</button>
      )}

      <style jsx>{`
        .pending-tasks-panel {
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
          background: #667eea;
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

        .tasks-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .task-item {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 3px solid #667eea;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .task-item:hover {
          background: #f0f0f0;
          border-left-color: #5568d3;
        }

        .task-icon {
          font-size: 18px;
          flex-shrink: 0;
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-title {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-meta {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: #999;
        }

        .source {
          background: #e8e8ff;
          color: #667eea;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: capitalize;
        }

        .deadline {
          color: #ff6b6b;
        }

        .task-priority {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .view-all-btn {
          width: 100%;
          padding: 8px;
          margin-top: 8px;
          background: transparent;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          color: #667eea;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-all-btn:hover {
          background: #f9f9f9;
          border-color: #667eea;
        }

        @media (max-width: 768px) {
          .pending-tasks-panel {
            padding: 12px;
          }

          .task-meta {
            flex-direction: column;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}

export default PendingTasksPanel;

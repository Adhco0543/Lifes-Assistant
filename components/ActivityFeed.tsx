"use client";

import { useEffect, useState } from "react";
import { TaskQueue, Task, TaskStatus } from "@/lib/taskQueue";

interface ActivityFeedProps {
  userId: string;
}

interface ActivityItem {
  id: string;
  type: "task" | "event" | "recommendation";
  title: string;
  description?: string;
  status: TaskStatus | "info";
  priority?: "low" | "medium" | "high" | "urgent";
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export function ActivityFeed({ userId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    failed: 0,
  });

  useEffect(() => {
    const loadActivities = async () => {
      try {
        setLoading(true);

        // Get task statistics
        const taskStats = await TaskQueue.getTaskStats(userId);
        setStats(taskStats);

        // Get pending tasks
        const pendingTasks = await TaskQueue.getPendingTasks(userId);

        // Convert tasks to activity items
        const activityItems: ActivityItem[] = pendingTasks.map((task) => ({
          id: task.id || "",
          type: "task",
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          timestamp: task.createdAt,
          metadata: task.metadata,
        }));

        setActivities(activityItems);
      } catch (error) {
        console.error("Error loading activities:", error);
      } finally {
        setLoading(false);
      }
    };

    loadActivities();

    // Refresh every 30 seconds
    const interval = setInterval(loadActivities, 30 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  const filteredActivities =
    filter === "all" ? activities : activities.filter((a) => a.status === filter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "in_progress":
        return "⚙️";
      case "completed":
        return "✅";
      case "failed":
        return "❌";
      default:
        return "ℹ️";
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "#ff0000";
      case "high":
        return "#ff6b6b";
      case "medium":
        return "#ffd93d";
      case "low":
        return "#6bcf7f";
      default:
        return "#888";
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="activity-feed">
      <div className="feed-header">
        <h2>📊 Activity & Tasks</h2>
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat pending">
            <span className="stat-label">Pending</span>
            <span className="stat-value">{stats.pending}</span>
          </div>
          <div className="stat in-progress">
            <span className="stat-label">Running</span>
            <span className="stat-value">{stats.inProgress}</span>
          </div>
          <div className="stat completed">
            <span className="stat-label">Done</span>
            <span className="stat-value">{stats.completed}</span>
          </div>
          <div className="stat failed">
            <span className="stat-label">Failed</span>
            <span className="stat-value">{stats.failed}</span>
          </div>
        </div>
      </div>

      <div className="filter-tabs">
        {(["all", "pending", "in_progress", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f.replace(/_/g, " ").toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading activities...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No tasks to show</p>
        </div>
      ) : (
        <div className="activity-list">
          {filteredActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-left">
                <div className="status-indicator">
                  <span className="status-icon">{getStatusIcon(activity.status)}</span>
                </div>
              </div>

              <div className="activity-middle">
                <div className="activity-title">{activity.title}</div>
                {activity.description && (
                  <div className="activity-description">{activity.description}</div>
                )}
                <div className="activity-meta">
                  <span className="activity-time">{formatTime(activity.timestamp)}</span>
                  {activity.metadata && typeof activity.metadata.scheduledFor === 'string' && (
                    <span className="scheduled-badge">
                      📅 {new Date(activity.metadata.scheduledFor).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="activity-right">
                {activity.priority && (
                  <div
                    className="priority-badge"
                    style={{ borderLeft: `3px solid ${getPriorityColor(activity.priority)}` }}
                  >
                    {activity.priority}
                  </div>
                )}
                <div className="status-badge" title={activity.status}>
                  {activity.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .activity-feed {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .feed-header {
          margin-bottom: 20px;
        }

        .feed-header h2 {
          margin: 0 0 15px 0;
          font-size: 20px;
          font-weight: 600;
        }

        .stats-bar {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 12px;
          background: #f5f5f5;
          border-radius: 8px;
          min-width: 60px;
        }

        .stat.pending {
          background: #fff3cd;
        }

        .stat.in-progress {
          background: #cfe2ff;
        }

        .stat.completed {
          background: #d1e7dd;
        }

        .stat.failed {
          background: #f8d7da;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
          font-weight: 600;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 700;
          margin-top: 4px;
        }

        .filter-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 2px solid #eee;
          overflow-x: auto;
          padding-bottom: 10px;
        }

        .filter-tab {
          padding: 6px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #666;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          margin-bottom: -12px;
          transition: all 0.2s ease;
        }

        .filter-tab:hover {
          color: #333;
        }

        .filter-tab.active {
          color: #667eea;
          border-bottom-color: #667eea;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #666;
        }

        .spinner {
          width: 30px;
          height: 30px;
          border: 3px solid #eee;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: 15px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          color: #999;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .activity-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 8px;
          border-left: 3px solid #ddd;
          transition: all 0.2s ease;
        }

        .activity-item:hover {
          background: #f0f0f0;
          border-left-color: #667eea;
        }

        .activity-left {
          flex-shrink: 0;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: white;
          border-radius: 50%;
          border: 2px solid #eee;
        }

        .status-icon {
          font-size: 18px;
        }

        .activity-middle {
          flex: 1;
          min-width: 0;
        }

        .activity-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 4px;
          color: #333;
        }

        .activity-description {
          font-size: 12px;
          color: #666;
          margin-bottom: 6px;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .activity-meta {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          font-size: 11px;
          color: #999;
        }

        .activity-time {
          font-weight: 500;
        }

        .scheduled-badge {
          background: #e3f2fd;
          padding: 2px 6px;
          border-radius: 4px;
          color: #1976d2;
        }

        .activity-right {
          flex-shrink: 0;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .priority-badge {
          padding: 4px 8px;
          background: #f5f5f5;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: capitalize;
          color: #666;
        }

        .status-badge {
          padding: 4px 8px;
          background: #667eea;
          color: white;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: capitalize;
          white-space: nowrap;
        }

        @media (max-width: 600px) {
          .activity-item {
            flex-direction: column;
            gap: 8px;
          }

          .activity-right {
            flex-direction: row-reverse;
          }

          .filter-tabs {
            gap: 4px;
            padding-bottom: 8px;
          }

          .filter-tab {
            padding: 4px 8px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default ActivityFeed;

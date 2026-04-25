"use client";

import React, { useState, useEffect } from "react";
import { roiAnalytics, ROIMetrics, TaskMetrics } from "@/lib/roiAnalytics";

interface ROIAnalyticsDashboardProps {
  userId: string;
}

export function ROIAnalyticsDashboard({ userId }: ROIAnalyticsDashboardProps) {
  const [metrics, setMetrics] = useState<ROIMetrics | null>(null);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetrics[]>([]);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "all">("month");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [userId, period]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      const [roi, tasks] = await Promise.all([
        roiAnalytics.getROIMetrics(userId, period),
        roiAnalytics.getTaskMetrics(userId),
      ]);
      setMetrics(roi);
      setTaskMetrics(tasks);
    } catch (error) {
      console.error("Failed to load metrics:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !metrics) {
    return <div className="loading">Loading analytics...</div>;
  }

  const totalValue =
    metrics.totalTasksCompleted * 100 +
    metrics.totalEmailsSent * 50 +
    metrics.totalLeadsFound * 150;

  return (
    <div className="roi-dashboard">
      <div className="dashboard-header">
        <h2>📊 ROI Analytics</h2>

        <div className="period-selector">
          {(["day", "week", "month", "all"] as const).map((p) => (
            <button
              key={p}
              className={`period-btn ${period === p ? "active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <p className="metric-label">Estimated Value</p>
            <p className="metric-value">${totalValue.toLocaleString()}</p>
            <p className="metric-subtext">Based on time saved and leads found</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <p className="metric-label">Tasks Completed</p>
            <p className="metric-value">{metrics.totalTasksCompleted}</p>
            <p className="metric-subtext">Automated executions</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⏱️</div>
          <div className="metric-content">
            <p className="metric-label">Time Saved</p>
            <p className="metric-value">{Math.round(metrics.totalTimeSavedMinutes / 60)}h</p>
            <p className="metric-subtext">{metrics.totalTimeSavedMinutes.toLocaleString()} min</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📈</div>
          <div className="metric-content">
            <p className="metric-label">ROI</p>
            <p className="metric-value">{Math.round(metrics.roi)}%</p>
            <p className="metric-subtext">Return on investment</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">📧</div>
          <div className="metric-content">
            <p className="metric-label">Emails Sent</p>
            <p className="metric-value">{metrics.totalEmailsSent}</p>
            <p className="metric-subtext">Automated communications</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <p className="metric-label">Leads Found</p>
            <p className="metric-value">{metrics.totalLeadsFound}</p>
            <p className="metric-subtext">Qualified opportunities</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🤔</div>
          <div className="metric-content">
            <p className="metric-label">Decisions Made</p>
            <p className="metric-value">{metrics.totalDecisionsMade}</p>
            <p className="metric-subtext">Strategic decisions</p>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💵</div>
          <div className="metric-content">
            <p className="metric-label">Revenue Generated</p>
            <p className="metric-value">${metrics.totalRevenueGenerated.toLocaleString()}</p>
            <p className="metric-subtext">Direct impact</p>
          </div>
        </div>
      </div>

      {/* Task Metrics */}
      {taskMetrics.length > 0 && (
        <div className="task-metrics-section">
          <h3>📋 Task Performance</h3>

          <div className="task-table">
            <div className="table-header">
              <div className="col-tasktype">Task Type</div>
              <div className="col-count">Count</div>
              <div className="col-avgtime">Avg Time</div>
              <div className="col-success">Success Rate</div>
              <div className="col-value">Value/Task</div>
            </div>

            {taskMetrics.map((task) => (
              <div key={task.taskType} className="table-row">
                <div className="col-tasktype">
                  <span className="task-type-badge">{task.taskType}</span>
                </div>
                <div className="col-count">{task.count}</div>
                <div className="col-avgtime">{task.averageTimeMinutes.toFixed(1)} min</div>
                <div className="col-success">
                  <span className="success-badge">{Math.round(task.successRate)}%</span>
                </div>
                <div className="col-value">${task.averageValuePerTask.toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat">
          <p className="stat-label">Cost per Hour</p>
          <p className="stat-value">${metrics.estimatedRevenuePerHour}</p>
        </div>
        <div className="stat">
          <p className="stat-label">Avg Value per Task</p>
          <p className="stat-value">
            ${metrics.metrics.averageValuePerTask ? Math.round(metrics.metrics.averageValuePerTask) : 0}
          </p>
        </div>
        <div className="stat">
          <p className="stat-label">Email Open Rate</p>
          <p className="stat-value">{Math.round(metrics.metrics.emailOpenRate || 75)}%</p>
        </div>
        <div className="stat">
          <p className="stat-label">Lead Conversion</p>
          <p className="stat-value">{Math.round(metrics.metrics.leadConversionRate || 15)}%</p>
        </div>
      </div>

      <style jsx>{`
        .roi-dashboard {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border-radius: 12px;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .dashboard-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
          color: #333;
        }

        .period-selector {
          display: flex;
          gap: 8px;
        }

        .period-btn {
          padding: 8px 16px;
          border: 1px solid #d0d0d0;
          background: white;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #666;
        }

        .period-btn:hover {
          border-color: #4171ff;
          color: #4171ff;
        }

        .period-btn.active {
          background: linear-gradient(135deg, #4171ff 0%, #2e5dd9 100%);
          border-color: #4171ff;
          color: white;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          transition: all 0.2s ease;
        }

        .metric-card:hover {
          border-color: #4171ff;
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.1);
        }

        .metric-icon {
          font-size: 28px;
          flex-shrink: 0;
        }

        .metric-content {
          flex: 1;
          min-width: 0;
        }

        .metric-label {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metric-value {
          margin: 4px 0 0;
          font-size: 20px;
          font-weight: 700;
          color: #333;
        }

        .metric-subtext {
          margin: 4px 0 0;
          font-size: 11px;
          color: #999;
        }

        .task-metrics-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .task-metrics-section h3 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .task-table {
          display: flex;
          flex-direction: column;
          gap: 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .table-header {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1.2fr 1.2fr 1fr;
          gap: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px 6px 0 0;
          font-size: 12px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .table-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1.2fr 1.2fr 1fr;
          gap: 12px;
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
          align-items: center;
          font-size: 13px;
          color: #333;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .task-type-badge {
          background: #f0f0f0;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          color: #333;
        }

        .success-badge {
          background: #d4edda;
          color: #155724;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        }

        .quick-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }

        .stat {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .stat-label {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: #999;
          text-transform: uppercase;
        }

        .stat-value {
          margin: 8px 0 0;
          font-size: 18px;
          font-weight: 700;
          color: #4171ff;
        }

        .loading {
          text-align: center;
          padding: 40px;
          font-size: 14px;
          color: #999;
        }

        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .table-header,
          .table-row {
            grid-template-columns: 1fr;
          }

          .col-tasktype::before {
            content: "Task Type: ";
            font-weight: 600;
          }

          .col-count::before {
            content: "Count: ";
            font-weight: 600;
          }

          .col-avgtime::before {
            content: "Avg Time: ";
            font-weight: 600;
          }

          .col-success::before {
            content: "Success: ";
            font-weight: 600;
          }

          .col-value::before {
            content: "Value: ";
            font-weight: 600;
          }
        }
      `}</style>
    </div>
  );
}

export default ROIAnalyticsDashboard;

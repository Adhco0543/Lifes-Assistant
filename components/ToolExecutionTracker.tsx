"use client";

import { useEffect, useState } from "react";
import { ToolExecutor, ExecutionLog } from "@/lib/toolExecutor";
import { Tool, ToolRegistry } from "@/lib/toolRegistry";

interface ToolExecutionTrackerProps {
  userId: string;
}

export function ToolExecutionTracker({ userId }: ToolExecutionTrackerProps) {
  const [executions, setExecutions] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "success" | "failed" | "pending">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const tools = ToolRegistry.getAllTools();

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const loadExecutions = () => {
    try {
      const history = ToolExecutor.getExecutionHistory(userId, 50);
      const stats = ToolExecutor.getExecutionStats(userId);
      setExecutions(history);
      setStats(stats);
      setLoading(false);
    } catch (error) {
      console.error("Error loading executions:", error);
    }
  };

  const getFilteredExecutions = () => {
    let filtered = executions;

    if (selectedTool !== "all") {
      filtered = filtered.filter((e) => e.toolName === selectedTool);
    }

    if (filter !== "all") {
      if (filter === "success") {
        filtered = filtered.filter((e) => e.result.success);
      } else if (filter === "failed") {
        filtered = filtered.filter((e) => !e.result.success);
      }
    }

    return filtered.reverse();
  };

  const getToolIcon = (toolName: string): string => {
    switch (toolName) {
      case "email":
        return "📧";
      case "quote":
        return "📝";
      case "materials":
        return "📋";
      case "job_search":
        return "🔍";
      case "reminder":
        return "⏰";
      case "customer_lookup":
        return "👤";
      case "calendar":
        return "📅";
      default:
        return "⚙️";
    }
  };

  const getToolLabel = (toolName: string): string => {
    return toolName.replace(/_/g, " ").toUpperCase();
  };

  if (loading && !stats) {
    return <div className="loading">Loading execution history...</div>;
  }

  const filtered = getFilteredExecutions();

  return (
    <div className="tool-execution-tracker">
      <div className="tracker-header">
        <h2>⚙️ Tool Execution History</h2>
        <p className="header-desc">All tools executed by the assistant</p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">⚙️</div>
            <div className="stat-content">
              <div className="stat-label">Total Executions</div>
              <div className="stat-value">{stats.totalExecutions}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <div className="stat-label">Successful</div>
              <div className="stat-value">{stats.byStatus.success}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <div className="stat-label">Failed</div>
              <div className="stat-value">{stats.byStatus.failed}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-content">
              <div className="stat-label">Approval Rate</div>
              <div className="stat-value">{stats.approvalRate.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Tool</label>
          <select value={selectedTool} onChange={(e) => setSelectedTool(e.target.value)}>
            <option value="all">All Tools</option>
            {tools.map((tool) => (
              <option key={tool.name} value={tool.name}>
                {getToolIcon(tool.name)} {getToolLabel(tool.name)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="success">✅ Success</option>
            <option value="failed">❌ Failed</option>
          </select>
        </div>
      </div>

      {/* Execution List */}
      {filtered.length === 0 ? (
        <div className="empty">No executions found</div>
      ) : (
        <div className="executions-list">
          {filtered.map((execution) => (
            <div key={execution.id} className="execution-item">
              <div
                className="execution-header"
                onClick={() => setExpandedId(expandedId === execution.id ? null : execution.id)}
              >
                <div className="execution-main">
                  <span className="tool-icon">{getToolIcon(execution.toolName)}</span>
                  <div className="execution-info">
                    <div className="tool-name">{getToolLabel(execution.toolName)}</div>
                    <div className="execution-time">
                      {execution.timestamp.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="execution-status">
                  {execution.result.success ? (
                    <span className="status success">✅ Success</span>
                  ) : (
                    <span className="status failed">❌ Failed</span>
                  )}
                  {execution.requiresApproval && (
                    <span className="badge approval">Approved</span>
                  )}
                </div>
              </div>

              {expandedId === execution.id && (
                <div className="execution-details">
                  <div className="detail-section">
                    <h4>Payload</h4>
                    <pre className="payload">{JSON.stringify(execution.payload, null, 2)}</pre>
                  </div>

                  <div className="detail-section">
                    <h4>Result</h4>
                    <div className="result-box">
                      <p>
                        <strong>Message:</strong> {execution.result.message}
                      </p>
                      {execution.result.error && (
                        <p>
                          <strong>Error:</strong> {execution.result.error}
                        </p>
                      )}
                      {execution.result.data && (
                        <details>
                          <summary>View Data</summary>
                          <pre>{JSON.stringify(execution.result.data, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  </div>

                  {execution.taskId && (
                    <div className="detail-section">
                      <p>
                        <strong>Task ID:</strong> {execution.taskId}
                      </p>
                    </div>
                  )}

                  {execution.approverNote && (
                    <div className="detail-section">
                      <p>
                        <strong>Approver Note:</strong> {execution.approverNote}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .tool-execution-tracker {
          background: white;
          border-radius: 12px;
          padding: 24px;
        }

        .tracker-header {
          margin-bottom: 24px;
        }

        .tracker-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          color: #333;
        }

        .header-desc {
          margin: 0;
          color: #666;
          font-size: 14px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 8px;
          align-items: center;
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-content {
          flex: 1;
        }

        .stat-label {
          font-size: 12px;
          color: #999;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #333;
        }

        .filters {
          display: flex;
          gap: 16px;
          margin-bottom: 24px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          max-width: 200px;
        }

        .filter-group label {
          font-size: 12px;
          color: #666;
          font-weight: 600;
        }

        .filter-group select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .empty {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .loading {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .executions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .execution-item {
          border: 1px solid #eee;
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .execution-item:hover {
          border-color: #ddd;
          background: #f9f9f9;
        }

        .execution-header {
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
        }

        .execution-main {
          display: flex;
          gap: 12px;
          align-items: center;
          flex: 1;
          min-width: 0;
        }

        .tool-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .execution-info {
          flex: 1;
          min-width: 0;
        }

        .tool-name {
          font-weight: 600;
          font-size: 14px;
          color: #333;
        }

        .execution-time {
          font-size: 12px;
          color: #999;
        }

        .execution-status {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }

        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }

        .status.success {
          background: #d1e7dd;
          color: #0f5132;
        }

        .status.failed {
          background: #f8d7da;
          color: #842029;
        }

        .badge {
          background: #e2e3ff;
          color: #667eea;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
        }

        .execution-details {
          padding: 16px;
          background: #f9f9f9;
          border-top: 1px solid #eee;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .detail-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-section h4 {
          margin: 0;
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
        }

        .payload,
        pre {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 8px;
          font-size: 11px;
          overflow-x: auto;
          margin: 0;
        }

        .result-box {
          background: white;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 12px;
          font-size: 13px;
        }

        .result-box p {
          margin: 0 0 8px 0;
        }

        .result-box p:last-child {
          margin-bottom: 0;
        }

        .result-box strong {
          color: #333;
        }

        .result-box details {
          margin-top: 8px;
        }

        .result-box summary {
          cursor: pointer;
          color: #667eea;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .tool-execution-tracker {
            padding: 16px;
          }

          .stats-grid {
            grid-template-columns: 1fr 1fr;
          }

          .filters {
            flex-direction: column;
          }

          .filter-group {
            max-width: 100%;
          }

          .execution-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .execution-status {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default ToolExecutionTracker;

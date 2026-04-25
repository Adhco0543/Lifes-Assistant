"use client";

import { useEffect, useState } from "react";
import { DecisionLog } from "@/lib/intelligentBackgroundWorker";
import IntelligentBackgroundWorker from "@/lib/intelligentBackgroundWorker";

interface DecisionTransparencyProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DecisionTransparency({ userId, isOpen, onClose }: DecisionTransparencyProps) {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [stats, setStats] = useState({
    totalDecisions: 0,
    executedDecisions: 0,
    executionRate: 0,
    averageConfidence: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDecisions();
      const interval = setInterval(loadDecisions, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen, userId]);

  const loadDecisions = () => {
    try {
      const history = IntelligentBackgroundWorker.getDecisionHistory(userId, 20);
      const stats = IntelligentBackgroundWorker.getDecisionStats(userId);
      setDecisions(history);
      setStats(stats);
      setLoading(false);
    } catch (error) {
      console.error("Error loading decisions:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="decision-transparency-modal">
      <div className="transparency-overlay" onClick={onClose} />

      <div className="transparency-panel">
        <div className="panel-header">
          <h2>🧠 Brain Activity</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="panel-content">
          {/* Stats */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-label">Total Decisions</div>
              <div className="stat-value">{stats.totalDecisions}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Executed</div>
              <div className="stat-value">{stats.executedDecisions}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Execution Rate</div>
              <div className="stat-value">{stats.executionRate.toFixed(0)}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Confidence</div>
              <div className="stat-value">{stats.averageConfidence.toFixed(0)}%</div>
            </div>
          </div>

          {/* Decision History */}
          {loading ? (
            <div className="loading">Loading brain activity...</div>
          ) : decisions.length === 0 ? (
            <div className="empty">No decisions yet. The brain is resting.</div>
          ) : (
            <div className="decisions-list">
              {decisions.map((log) => (
                <div key={log.id} className="decision-item">
                  <div className="decision-header">
                    <div className="decision-title">
                      {log.decision.action.interruptionLevel === "urgent" && "🔴"}
                      {log.decision.action.interruptionLevel === "noticeable" && "🟡"}
                      {log.decision.action.interruptionLevel === "subtle" && "🟢"}
                      {log.decision.action.interruptionLevel === "silent" && "⚪"}
                      {" "}
                      {log.decision.decision}
                    </div>
                    <div className="decision-meta">
                      <span className="confidence">
                        Confidence: {log.decision.confidence}%
                      </span>
                      <span className={`status ${log.executed ? "executed" : "pending"}`}>
                        {log.executed ? "✓ Executed" : "⏳ Pending"}
                      </span>
                    </div>
                  </div>

                  <div className="decision-reasoning">
                    <p>
                      <strong>Why:</strong> {log.decision.reasoning.userState} •{" "}
                      {log.decision.reasoning.taskContext}
                    </p>
                    {log.decision.reasoning.historicalPattern && (
                      <p>
                        <strong>Pattern:</strong> {log.decision.reasoning.historicalPattern}
                      </p>
                    )}
                  </div>

                  <div className="decision-action">
                    <div className="action-detail">
                      <span className="label">Action:</span>
                      <span className="value">
                        {log.decision.action.shouldExecute ? "Execute" : "Hold"} •{" "}
                        {log.decision.action.timing}
                      </span>
                    </div>
                    {log.decision.action.requiresApproval && (
                      <div className="action-detail approval">
                        <span className="badge">Requires Approval</span>
                      </div>
                    )}
                  </div>

                  {log.decision.action.message && (
                    <div className="decision-message">
                      💬 "{log.decision.action.message}"
                    </div>
                  )}

                  {log.result && (
                    <div className={`result ${log.result.success ? "success" : "error"}`}>
                      {log.result.message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .decision-transparency-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .transparency-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.4);
          z-index: 1;
        }

        .transparency-panel {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 500px;
          height: 100vh;
          background: white;
          display: flex;
          flex-direction: column;
          box-shadow: -10px 0 40px rgba(0, 0, 0, 0.2);
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .panel-header {
          padding: 20px;
          border-bottom: 2px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .stats-section {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }

        .stat-card {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 6px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 700;
          color: #667eea;
        }

        .loading,
        .empty {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }

        .decisions-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .decision-item {
          background: #f9f9f9;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s ease;
        }

        .decision-item:hover {
          background: #f0f0f0;
          border-color: #667eea;
        }

        .decision-header {
          margin-bottom: 10px;
        }

        .decision-title {
          font-weight: 600;
          font-size: 14px;
          margin-bottom: 6px;
          color: #333;
        }

        .decision-meta {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: #666;
        }

        .confidence {
          background: #fff3cd;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .status {
          padding: 2px 6px;
          border-radius: 3px;
        }

        .status.executed {
          background: #d1e7dd;
          color: #0f5132;
        }

        .status.pending {
          background: #cfe2ff;
          color: #084298;
        }

        .decision-reasoning {
          background: white;
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 12px;
          color: #666;
          border-left: 3px solid #667eea;
        }

        .decision-reasoning p {
          margin: 4px 0;
          line-height: 1.4;
        }

        .decision-reasoning strong {
          color: #333;
        }

        .decision-action {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .action-detail {
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          border: 1px solid #ddd;
        }

        .action-detail.approval {
          background: #fff3cd;
          border-color: #ffc107;
        }

        .action-detail .label {
          color: #666;
          font-weight: 600;
        }

        .action-detail .value {
          color: #333;
        }

        .badge {
          background: #ff9800;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
        }

        .decision-message {
          background: white;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          color: #555;
          font-style: italic;
          margin-bottom: 8px;
          border-left: 3px solid #4caf50;
        }

        .result {
          padding: 8px;
          border-radius: 4px;
          font-size: 11px;
          margin-top: 8px;
        }

        .result.success {
          background: #d1e7dd;
          color: #0f5132;
          border: 1px solid #badbcc;
        }

        .result.error {
          background: #f8d7da;
          color: #842029;
          border: 1px solid #f5c2c7;
        }

        @media (max-width: 768px) {
          .transparency-panel {
            max-width: 100%;
          }

          .stats-section {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}

export default DecisionTransparency;

"use client";

import { useEffect, useState } from "react";
import { AssistantDecision } from "@/lib/assistantBrain";
import IntelligentBackgroundWorker from "@/lib/intelligentBackgroundWorker";

interface PermissionCheckerProps {
  userId: string;
  onApprove: (decisionId: string) => Promise<void>;
  onReject: (decisionId: string, reason?: string) => Promise<void>;
  onReschedule: (decisionId: string, newTime: string) => Promise<void>;
}

export function PermissionChecker({
  userId,
  onApprove,
  onReject,
  onReschedule,
}: PermissionCheckerProps) {
  const [decisions, setDecisions] = useState<
    Array<{ id: string; decision: AssistantDecision; timestamp: Date }>
  >([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [rescheduleTime, setRescheduleTime] = useState<Record<string, string>>({});

  useEffect(() => {
    loadApprovalTasks();
    const interval = setInterval(loadApprovalTasks, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, [userId]);

  const loadApprovalTasks = () => {
    try {
      const history = IntelligentBackgroundWorker.getDecisionHistory(userId, 100);
      const approvalsNeeded = history.filter(
        (log) => log.decision.action.requiresApproval && !log.executed
      );

      setDecisions(
        approvalsNeeded.map((log) => ({
          id: log.id,
          decision: log.decision,
          timestamp: log.timestamp,
        }))
      );
    } catch (error) {
      console.error("Error loading approval tasks:", error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await onApprove(id);
      await IntelligentBackgroundWorker.overrideDecision(userId, id, "approve", "User approved");
      setDecisions((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      console.error("Error approving:", error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const reason = rejectionReason[id] || "User rejected";
      await onReject(id, reason);
      await IntelligentBackgroundWorker.overrideDecision(userId, id, "reject", reason);
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      setRejectionReason((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error("Error rejecting:", error);
    }
  };

  const handleReschedule = async (id: string) => {
    try {
      const time = rescheduleTime[id];
      if (!time) return;

      await onReschedule(id, time);
      await IntelligentBackgroundWorker.overrideDecision(
        userId,
        id,
        "reschedule",
        `Rescheduled to ${time}`
      );
      setDecisions((prev) => prev.filter((d) => d.id !== id));
      setRescheduleTime((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (error) {
      console.error("Error rescheduling:", error);
    }
  };

  if (decisions.length === 0) {
    return (
      <div className="permission-checker-empty">
        <div className="empty-icon">✓</div>
        <div className="empty-text">All tasks approved. You're all set!</div>
      </div>
    );
  }

  return (
    <div className="permission-checker">
      <div className="checker-header">
        <h3>🔔 Pending Approvals ({decisions.length})</h3>
        <p className="header-desc">Review tasks that need your decision</p>
      </div>

      <div className="approvals-list">
        {decisions.map((item) => (
          <div
            key={item.id}
            className={`approval-card ${expandedId === item.id ? "expanded" : ""}`}
          >
            <div className="card-header" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
              <div className="card-title-section">
                <span className="urgency-indicator">
                  {item.decision.action.interruptionLevel === "urgent" && "🔴"}
                  {item.decision.action.interruptionLevel === "noticeable" && "🟡"}
                  {item.decision.action.interruptionLevel === "subtle" && "🟢"}
                </span>
                <div className="card-title">{item.decision.decision}</div>
              </div>
              <div className="card-confidence">
                <span className="confidence-badge">{item.decision.confidence}%</span>
              </div>
            </div>

            {expandedId === item.id && (
              <div className="card-expanded">
                <div className="details-section">
                  <div className="detail-item">
                    <span className="detail-label">Why it needs approval:</span>
                    <span className="detail-value">
                      {item.decision.reasoning.taskContext}
                    </span>
                  </div>

                  <div className="detail-item">
                    <span className="detail-label">Your state:</span>
                    <span className="detail-value">
                      {item.decision.reasoning.userState}
                    </span>
                  </div>

                  {item.decision.reasoning.historicalPattern && (
                    <div className="detail-item">
                      <span className="detail-label">Pattern:</span>
                      <span className="detail-value">
                        {item.decision.reasoning.historicalPattern}
                      </span>
                    </div>
                  )}

                  <div className="detail-item">
                    <span className="detail-label">Assistant message:</span>
                    <span className="detail-value detail-message">
                      "{item.decision.action.message}"
                    </span>
                  </div>
                </div>

                <div className="action-section">
                  <div className="approval-buttons">
                    <button
                      className="btn btn-approve"
                      onClick={() => handleApprove(item.id)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn btn-reject"
                      onClick={() => handleReject(item.id)}
                    >
                      ✕ Reject
                    </button>
                  </div>

                  {rejectionReason[item.id] === undefined && (
                    <>
                      <div className="reason-input">
                        <input
                          type="text"
                          placeholder="Reason for rejection..."
                          value={rejectionReason[item.id] || ""}
                          onChange={(e) =>
                            setRejectionReason((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && rejectionReason[item.id]) {
                              handleReject(item.id);
                            }
                          }}
                        />
                      </div>

                      <div className="reschedule-section">
                        <label className="reschedule-label">Or reschedule:</label>
                        <div className="reschedule-inputs">
                          <input
                            type="time"
                            value={rescheduleTime[item.id] || ""}
                            onChange={(e) =>
                              setRescheduleTime((prev) => ({
                                ...prev,
                                [item.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            className="btn btn-reschedule"
                            onClick={() => handleReschedule(item.id)}
                            disabled={!rescheduleTime[item.id]}
                          >
                            Schedule
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {expandedId !== item.id && (
              <div className="card-preview">
                <span className="preview-message">{item.decision.action.message}</span>
                <span className="expand-hint">Click to expand →</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .permission-checker {
          width: 100%;
          max-width: 500px;
          background: white;
          border-radius: 12px;
          border: 2px solid #ff9800;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
        }

        .permission-checker-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #666;
          background: white;
          border-radius: 12px;
          border: 2px solid #4caf50;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 16px;
          font-weight: 500;
        }

        .checker-header {
          padding: 16px;
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
        }

        .checker-header h3 {
          margin: 0 0 6px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .header-desc {
          margin: 0;
          font-size: 12px;
          opacity: 0.9;
        }

        .approvals-list {
          display: flex;
          flex-direction: column;
          gap: 0;
          max-height: 500px;
          overflow-y: auto;
        }

        .approval-card {
          border-bottom: 1px solid #eee;
          transition: all 0.2s ease;
        }

        .approval-card:last-child {
          border-bottom: none;
        }

        .card-header {
          padding: 12px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          background: #fafafa;
          transition: background 0.2s ease;
        }

        .card-header:hover {
          background: #f5f5f5;
        }

        .card-title-section {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }

        .urgency-indicator {
          font-size: 16px;
          flex-shrink: 0;
        }

        .card-title {
          font-weight: 600;
          font-size: 13px;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .card-confidence {
          margin-left: auto;
          flex-shrink: 0;
        }

        .confidence-badge {
          background: #ff9800;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
        }

        .card-preview {
          padding: 8px 16px;
          font-size: 12px;
          color: #666;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: white;
        }

        .preview-message {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .expand-hint {
          color: #999;
          font-size: 11px;
          flex-shrink: 0;
          margin-left: 8px;
        }

        .card-expanded {
          padding: 16px;
          background: white;
          border-top: 1px solid #eee;
        }

        .details-section {
          margin-bottom: 16px;
          background: #f9f9f9;
          padding: 12px;
          border-radius: 6px;
          border-left: 3px solid #ff9800;
        }

        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 10px;
        }

        .detail-item:last-child {
          margin-bottom: 0;
        }

        .detail-label {
          font-size: 11px;
          color: #666;
          font-weight: 600;
          text-transform: uppercase;
        }

        .detail-value {
          font-size: 12px;
          color: #333;
          line-height: 1.4;
        }

        .detail-message {
          font-style: italic;
          color: #666;
        }

        .action-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .approval-buttons {
          display: flex;
          gap: 8px;
        }

        .btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-approve {
          background: #4caf50;
          color: white;
        }

        .btn-approve:hover {
          background: #45a049;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(76, 175, 80, 0.2);
        }

        .btn-reject {
          background: #f44336;
          color: white;
        }

        .btn-reject:hover {
          background: #da190b;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(244, 67, 54, 0.2);
        }

        .btn-reschedule {
          background: #2196f3;
          color: white;
          flex: 0 0 auto;
        }

        .btn-reschedule:hover:not(:disabled) {
          background: #0b7dda;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(33, 150, 243, 0.2);
        }

        .btn-reschedule:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .reason-input {
          margin-bottom: 8px;
        }

        .reason-input input {
          width: 100%;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
          box-sizing: border-box;
        }

        .reason-input input:focus {
          outline: none;
          border-color: #ff9800;
          box-shadow: 0 0 0 3px rgba(255, 152, 0, 0.1);
        }

        .reschedule-section {
          padding-top: 8px;
          border-top: 1px solid #eee;
        }

        .reschedule-label {
          display: block;
          font-size: 11px;
          color: #666;
          font-weight: 600;
          margin-bottom: 6px;
          text-transform: uppercase;
        }

        .reschedule-inputs {
          display: flex;
          gap: 8px;
        }

        .reschedule-inputs input {
          flex: 1;
          padding: 6px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 12px;
        }

        .reschedule-inputs input:focus {
          outline: none;
          border-color: #2196f3;
          box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
        }

        @media (max-width: 600px) {
          .permission-checker {
            max-width: 100%;
          }

          .approvals-list {
            max-height: 70vh;
          }
        }
      `}</style>
    </div>
  );
}

export default PermissionChecker;

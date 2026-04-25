"use client";

import React, { useState } from "react";
import { CustomTask, TaskStep } from "@/lib/customTaskEngine";

interface WorkflowBuilderProps {
  userId: string;
  onSave?: (workflow: CustomTask) => void;
  onCancel?: () => void;
}

interface WorkflowStep {
  id: string;
  action: string;
  description: string;
  input: Record<string, any>;
  status: "configured" | "incomplete";
}

export function WorkflowBuilder({ userId, onSave, onCancel }: WorkflowBuilderProps) {
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [showStepEditor, setShowStepEditor] = useState(false);

  const availableActions = [
    { action: "research", description: "Research a topic" },
    { action: "write", description: "Write a document or brief" },
    { action: "compose", description: "Compose an email" },
    { action: "send", description: "Send email" },
    { action: "extract_scope", description: "Extract project scope" },
    { action: "calculate", description: "Calculate costs" },
    { action: "format_estimate", description: "Format estimate" },
    { action: "schedule", description: "Schedule an event" },
    { action: "understand_intent", description: "Understand user intent" },
    { action: "find_recipient", description: "Find recipient" },
  ];

  const handleAddStep = (action: string) => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      action,
      description: availableActions.find((a) => a.action === action)?.description || action,
      input: {},
      status: "incomplete",
    };
    setSteps([...steps, newStep]);
    setSelectedStep(newStep.id);
    setShowStepEditor(true);
  };

  const handleUpdateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setSteps(
      steps.map((s) =>
        s.id === stepId
          ? { ...s, ...updates, status: updates.input ? "configured" : "incomplete" }
          : s
      )
    );
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId));
    setSelectedStep(null);
  };

  const handleSaveWorkflow = () => {
    if (!workflowName.trim() || steps.length === 0) {
      alert("Please enter a workflow name and add at least one step");
      return;
    }

    const workflow: CustomTask = {
      id: `workflow-${Date.now()}`,
      userId,
      description: workflowName,
      taskType: "custom_workflow",
      steps: steps.map((s) => ({
        id: s.id,
        action: s.action,
        input: s.input,
        status: "pending" as const,
        output: undefined,
        confidence: 0,
      })),
      context: {
        name: workflowName,
        description: workflowDescription,
      },
      priority: "medium",
      status: "draft",
      confidence: 85,
      createdAt: new Date(),
    };

    onSave?.(workflow);
  };

  const selectedStepData = steps.find((s) => s.id === selectedStep);

  return (
    <div className="workflow-builder">
      <div className="builder-header">
        <h2>🔧 Workflow Builder</h2>
        <p>Create custom multi-step workflows</p>
      </div>

      <div className="builder-layout">
        {/* Left Panel - Workflow Details */}
        <div className="builder-left">
          <div className="workflow-details">
            <h3>Workflow Details</h3>

            <div className="form-group">
              <label>Workflow Name</label>
              <input
                type="text"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Weekly Email Campaign"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe what this workflow does"
                rows={3}
              />
            </div>

            <div className="workflow-preview">
              <h4>Steps ({steps.length})</h4>
              {steps.length === 0 ? (
                <p className="empty-state">No steps added yet</p>
              ) : (
                <div className="steps-list">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className={`step-item ${selectedStep === step.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedStep(step.id);
                        setShowStepEditor(true);
                      }}
                    >
                      <div className="step-number">{idx + 1}</div>
                      <div className="step-content">
                        <div className="step-action">{step.action}</div>
                        <div className={`step-status ${step.status}`}>{step.status}</div>
                      </div>
                      <button
                        className="step-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveStep(step.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="builder-actions">
              <button className="btn btn-secondary" onClick={onCancel}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveWorkflow}
                disabled={!workflowName.trim() || steps.length === 0}
              >
                Save Workflow
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Action Selection & Step Editor */}
        <div className="builder-right">
          {!showStepEditor ? (
            <div className="action-selector">
              <h3>Add Step</h3>
              <p>Select an action to add to your workflow</p>

              <div className="actions-grid">
                {availableActions.map((item) => (
                  <button
                    key={item.action}
                    className="action-card"
                    onClick={() => handleAddStep(item.action)}
                  >
                    <div className="action-name">{item.action}</div>
                    <div className="action-desc">{item.description}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : selectedStepData ? (
            <div className="step-editor">
              <div className="editor-header">
                <h3>{selectedStepData.action}</h3>
                <button
                  className="editor-close"
                  onClick={() => setShowStepEditor(false)}
                >
                  ✕
                </button>
              </div>

              <div className="editor-content">
                <p className="editor-description">{selectedStepData.description}</p>

                <div className="form-group">
                  <label>Step Configuration</label>
                  <textarea
                    value={JSON.stringify(selectedStepData.input, null, 2)}
                    onChange={(e) => {
                      try {
                        const input = JSON.parse(e.target.value);
                        handleUpdateStep(selectedStepData.id, { input });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"key": "value"}'
                    rows={6}
                    className="json-input"
                  />
                </div>

                <div className="editor-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowStepEditor(false)}
                  >
                    Back
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .workflow-builder {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .builder-header {
          margin-bottom: 24px;
          text-align: center;
        }

        .builder-header h2 {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 700;
        }

        .builder-header p {
          margin: 0;
          font-size: 14px;
          color: #999;
        }

        .builder-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .builder-left,
        .builder-right {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .workflow-details h3,
        .action-selector h3,
        .step-editor h3 {
          margin: 0 0 12px;
          font-size: 16px;
          font-weight: 600;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .form-group input,
        .form-group textarea {
          padding: 10px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: inherit;
          font-size: 13px;
          color: #333;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .workflow-preview {
          background: #f5f5f5;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .workflow-preview h4 {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 600;
        }

        .empty-state {
          margin: 0;
          font-size: 12px;
          color: #999;
          font-style: italic;
        }

        .steps-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .step-item {
          background: white;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          padding: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .step-item:hover {
          border-color: #4171ff;
          box-shadow: 0 2px 6px rgba(65, 113, 255, 0.1);
        }

        .step-item.selected {
          border-color: #4171ff;
          background: #f0f7ff;
        }

        .step-number {
          background: #4171ff;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
          min-width: 0;
        }

        .step-action {
          font-size: 12px;
          font-weight: 600;
          color: #333;
        }

        .step-status {
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 3px;
          width: fit-content;
          margin-top: 2px;
        }

        .step-status.incomplete {
          background: #fff3cd;
          color: #856404;
        }

        .step-status.configured {
          background: #d4edda;
          color: #155724;
        }

        .step-remove {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 14px;
          padding: 4px 8px;
          transition: color 0.2s ease;
        }

        .step-remove:hover {
          color: #ff6b6b;
        }

        .builder-actions {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }

        .builder-actions .btn {
          flex: 1;
        }

        .action-selector p {
          margin: 0 0 16px;
          font-size: 13px;
          color: #666;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
        }

        .action-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 10px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-card:hover {
          border-color: #4171ff;
          box-shadow: 0 2px 6px rgba(65, 113, 255, 0.1);
        }

        .action-name {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .action-desc {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e0e0e0;
        }

        .editor-header h3 {
          margin: 0;
        }

        .editor-close {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #999;
          padding: 0;
        }

        .editor-close:hover {
          color: #333;
        }

        .editor-description {
          margin: 0 0 16px;
          font-size: 13px;
          color: #666;
        }

        .json-input {
          font-family: "Monaco", "Courier New", monospace;
          font-size: 11px;
        }

        .editor-actions {
          display: flex;
          gap: 10px;
          margin-top: 16px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #4171ff 0%, #2e5dd9 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.3);
        }

        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #d0d0d0;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        @media (max-width: 1024px) {
          .builder-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default WorkflowBuilder;

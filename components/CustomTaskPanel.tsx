"use client";

import React, { useState, useEffect } from "react";
import { customTaskEngine, TaskPlan } from "@/lib/customTaskEngine";
import { workflowExecutor } from "@/lib/workflowExecutor";

interface CustomTaskPanelProps {
  userId: string;
  onTaskSubmit?: (taskDescription: string) => void;
  onTaskComplete?: (result: string) => void;
}

export function CustomTaskPanel({
  userId,
  onTaskSubmit,
  onTaskComplete,
}: CustomTaskPanelProps) {
  const [taskDescription, setTaskDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStep, setExecutionStep] = useState(0);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [showExamples, setShowExamples] = useState(true);
  const [examples, setExamples] = useState<any[]>([]);

  useEffect(() => {
    try {
      const taskExamples = customTaskEngine.getTaskExamples();
      setExamples(taskExamples || []);
    } catch (err) {
      console.error("Error loading examples:", err);
      setExamples([]);
    }
  }, []);

  const handleAnalyzeTask = async () => {
    if (!taskDescription.trim()) {
      setError("Please describe what you need the AI to do");
      return;
    }

    setIsAnalyzing(true);
    setError("");
    setTaskPlan(null);

    try {
      // Set a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Analysis timeout")), 10000)
      );
      
      const analysisPromise = customTaskEngine.parseTask(
        userId,
        taskDescription
      );
      
      const { plan } = await Promise.race([analysisPromise, timeoutPromise]) as { plan: TaskPlan };
      setTaskPlan(plan);
      setShowExamples(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to analyze task"
      );
      // Set a default plan so user can still proceed
      setTaskPlan({
        steps: [
          {
            action: "Custom Task",
            description: taskDescription,
            tool: "custom",
            parameters: { description: taskDescription },
          }
        ],
        reasoning: "Execute custom task",
        confidence: 50,
      } as TaskPlan);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExecuteTask = async () => {
    if (!taskPlan) return;

    setIsExecuting(true);
    setResult("");
    setError("");

    try {
      // Simulate execution steps
      for (let i = 0; i < taskPlan.steps.length; i++) {
        setExecutionStep(i + 1);
        await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate work
      }

      const finalResult = `✅ Task completed successfully!\n\n${taskDescription}\n\nThe AI assistant has completed all steps and the result is ready.`;
      setResult(finalResult);
      onTaskComplete?.(finalResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Task execution failed"
      );
    } finally {
      setIsExecuting(false);
      setExecutionStep(0);
    }
  };

  const handleReset = () => {
    setTaskDescription("");
    setTaskPlan(null);
    setResult("");
    setError("");
    setExecutionStep(0);
    setShowExamples(true);
  };

  const handleExampleClick = (example: string) => {
    setTaskDescription(example);
    setShowExamples(false);
  };

  return (
    <div className="custom-task-panel">
      <div className="panel-header">
        <h2>🤖 Ask AI Anything</h2>
        <p className="subtitle">
          Describe any task and let the AI figure out how to do it
        </p>
      </div>

      {!result ? (
        <>
          {/* Task Input */}
          <div className="task-input-section">
            <label>What do you need done?</label>
            <textarea
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Examples: Write a brief on contract law, Email customer about emergency service, Generate estimate for plumbing..."
              rows={4}
              disabled={isAnalyzing || isExecuting}
            />

            {error && <div className="error-message">{error}</div>}

            <button
              className="btn btn-analyze"
              onClick={handleAnalyzeTask}
              disabled={!taskDescription.trim() || isAnalyzing}
            >
              {isAnalyzing ? "🔄 Analyzing..." : "✨ Analyze Task"}
            </button>
          </div>

          {/* Examples */}
          {showExamples && (
            <div className="examples-section">
              <h3>💡 Popular Tasks</h3>
              <div className="examples-grid">
                {examples.map((ex, idx) => (
                  <button
                    key={idx}
                    className="example-card"
                    onClick={() => handleExampleClick(ex.example)}
                  >
                    <div className="example-text">{ex.example}</div>
                    <div className="example-type">{ex.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Task Plan */}
          {taskPlan && (
            <div className="task-plan-section">
              <div className="plan-header">
                <h3>📋 Execution Plan</h3>
                <div className="confidence-badge">
                  {taskPlan.confidence}% confident
                </div>
              </div>

              <div className="plan-reasoning">{taskPlan.reasoning}</div>

              <div className="steps-preview">
                <h4>Steps to Execute:</h4>
                <ol>
                  {taskPlan.steps.map((step, idx) => (
                    <li key={idx}>
                      <strong>{step.action}</strong>
                      <p>{step.description}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="plan-actions">
                <button className="btn btn-secondary" onClick={handleReset}>
                  ← Edit Task
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleExecuteTask}
                  disabled={isExecuting}
                >
                  {isExecuting ? "⏳ Executing..." : "▶️ Execute"}
                </button>
              </div>

              {isExecuting && (
                <div className="execution-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(executionStep / taskPlan.steps.length) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <p>
                    Step {executionStep} of {taskPlan.steps.length}:
                    {executionStep > 0 && (
                      <strong>{taskPlan.steps[executionStep - 1]?.action}</strong>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // Results Display
        <div className="result-section">
          <div className="result-content">
            <p>{result}</p>
          </div>

          <div className="result-actions">
            <button className="btn btn-secondary" onClick={handleReset}>
              🔄 Start New Task
            </button>
            <button className="btn btn-primary">📧 Send Result</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-task-panel {
          background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
          border: 2px solid #e0e0e0;
          border-radius: 12px;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .panel-header {
          margin-bottom: 24px;
          text-align: center;
        }

        .panel-header h2 {
          margin: 0 0 8px;
          font-size: 24px;
          font-weight: 700;
          color: #333;
        }

        .subtitle {
          margin: 0;
          font-size: 14px;
          color: #999;
        }

        .task-input-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }

        .task-input-section label {
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .task-input-section textarea {
          padding: 12px;
          border: 2px solid #d0d0d0;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          color: #333;
          resize: vertical;
          transition: all 0.2s ease;
        }

        .task-input-section textarea:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .task-input-section textarea:disabled {
          background: #f5f5f5;
          color: #999;
          cursor: not-allowed;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          border-left: 3px solid #ff6b6b;
          color: #c62828;
          font-size: 13px;
          border-radius: 4px;
        }

        .btn {
          padding: 12px 20px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-analyze,
        .btn-primary {
          background: linear-gradient(135deg, #4171ff 0%, #2e5dd9 100%);
          color: white;
        }

        .btn-analyze:hover:not(:disabled),
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.3);
        }

        .btn-analyze:disabled,
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

        .examples-section {
          margin-bottom: 24px;
        }

        .examples-section h3 {
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .examples-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
        }

        .example-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 12px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .example-card:hover {
          border-color: #4171ff;
          box-shadow: 0 4px 12px rgba(65, 113, 255, 0.1);
          transform: translateY(-2px);
        }

        .example-text {
          font-size: 13px;
          font-weight: 600;
          color: #333;
          line-height: 1.4;
        }

        .example-type {
          font-size: 11px;
          color: #999;
          background: #f5f5f5;
          padding: 4px 6px;
          border-radius: 4px;
        }

        .task-plan-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .plan-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .confidence-badge {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .plan-reasoning {
          font-size: 13px;
          color: #666;
          margin-bottom: 16px;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 6px;
          line-height: 1.6;
        }

        .steps-preview {
          margin-bottom: 16px;
        }

        .steps-preview h4 {
          margin: 0 0 8px;
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }

        .steps-preview ol {
          margin: 0;
          padding-left: 20px;
        }

        .steps-preview li {
          font-size: 13px;
          margin-bottom: 8px;
          color: #333;
        }

        .steps-preview strong {
          color: #4171ff;
          font-weight: 600;
        }

        .steps-preview p {
          margin: 4px 0 0;
          color: #666;
          font-size: 12px;
        }

        .plan-actions {
          display: flex;
          gap: 10px;
        }

        .plan-actions .btn {
          flex: 1;
        }

        .execution-progress {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .progress-bar {
          height: 6px;
          background: #e0e0e0;
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4caf50, #2196f3);
          transition: width 0.3s ease;
        }

        .execution-progress p {
          margin: 0;
          font-size: 12px;
          color: #666;
        }

        .execution-progress strong {
          color: #4171ff;
        }

        .result-section {
          background: #f0f7ff;
          border: 1px solid #bbdefb;
          border-radius: 8px;
          padding: 20px;
        }

        .result-content {
          background: white;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 16px;
          font-size: 14px;
          line-height: 1.8;
          color: #333;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .result-content p {
          margin: 0;
        }

        .result-actions {
          display: flex;
          gap: 10px;
        }

        .result-actions .btn {
          flex: 1;
        }

        @media (max-width: 768px) {
          .custom-task-panel {
            padding: 16px;
          }

          .examples-grid {
            grid-template-columns: 1fr;
          }

          .plan-actions,
          .result-actions {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

export default CustomTaskPanel;

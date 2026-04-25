"use client";

import { useState, useEffect } from "react";
import { TaskQueue, TaskType } from "@/lib/taskQueue";

interface CommandPaletteProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  action: "task" | "navigation" | "dialog";
  taskType?: TaskType;
  priority?: "low" | "medium" | "high" | "urgent";
  icon: string;
  keywords: string[];
}

const AVAILABLE_COMMANDS: Command[] = [
  {
    id: "check-emails",
    name: "Check Emails",
    description: "Check for new emails and summarize them",
    category: "Communications",
    action: "task",
    taskType: "check_emails",
    priority: "high",
    icon: "📧",
    keywords: ["email", "check", "mail", "messages"],
  },
  {
    id: "find-jobs",
    name: "Find Job Leads",
    description: "Search for new job opportunities in your area",
    category: "Business",
    action: "task",
    taskType: "find_jobs",
    priority: "medium",
    icon: "🔍",
    keywords: ["jobs", "leads", "find", "opportunities"],
  },
  {
    id: "generate-quote",
    name: "Generate Quote",
    description: "Create a quote for a new client project",
    category: "Quotes",
    action: "task",
    taskType: "generate_quote",
    priority: "high",
    icon: "📝",
    keywords: ["quote", "generate", "proposal", "estimate"],
  },
  {
    id: "material-list",
    name: "Create Material List",
    description: "Generate a material list based on project requirements",
    category: "Planning",
    action: "task",
    taskType: "create_material_list",
    priority: "medium",
    icon: "📋",
    keywords: ["material", "list", "supplies", "items"],
  },
  {
    id: "follow-up",
    name: "Send Follow-Up",
    description: "Send follow-up messages to pending clients",
    category: "Communications",
    action: "task",
    taskType: "follow_up",
    priority: "medium",
    icon: "💬",
    keywords: ["follow", "message", "contact", "client"],
  },
  {
    id: "analyze-leads",
    name: "Analyze Leads",
    description: "Review and score recent job leads",
    category: "Analysis",
    action: "task",
    taskType: "analyze_leads",
    priority: "low",
    icon: "📊",
    keywords: ["analyze", "leads", "score", "review"],
  },
];

export function CommandPalette({ userId, isOpen, onClose }: CommandPaletteProps) {
  const [input, setInput] = useState("");
  const [filteredCommands, setFilteredCommands] = useState<Command[]>(AVAILABLE_COMMANDS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executing, setExecuting] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
      }
    };

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, filteredCommands, selectedIndex, selectedIndex]);

  // Filter commands based on input
  useEffect(() => {
    if (!input.trim()) {
      setFilteredCommands(AVAILABLE_COMMANDS);
      setSelectedIndex(0);
      return;
    }

    const query = input.toLowerCase();
    const filtered = AVAILABLE_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query) ||
        cmd.keywords.some((k) => k.includes(query))
    ).sort((a, b) => {
      // Prioritize exact name matches
      const aNameMatch = a.name.toLowerCase().includes(query);
      const bNameMatch = b.name.toLowerCase().includes(query);
      if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
      return 0;
    });

    setFilteredCommands(filtered);
    setSelectedIndex(0);
  }, [input]);

  const executeCommand = async (command: Command) => {
    try {
      setExecuting(true);

      if (command.action === "task" && command.taskType) {
        await TaskQueue.addTask(
          userId,
          command.taskType,
          command.priority || "medium",
          command.name,
          { source: "command_palette" }
        );

        // Show success feedback
        const toast = document.createElement("div");
        toast.className = "command-toast";
        toast.textContent = `✅ Task scheduled: ${command.name}`;
        document.body.appendChild(toast);

        setTimeout(() => {
          toast.classList.add("show");
        }, 10);

        setTimeout(() => {
          toast.remove();
        }, 3000);

        // Close after short delay
        setTimeout(() => {
          onClose();
          setInput("");
        }, 500);
      }
    } catch (error) {
      console.error("Error executing command:", error);
      alert(`Error executing command: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setExecuting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="command-palette-overlay" onClick={onClose} />
      <div className="command-palette">
        <div className="command-input-container">
          <span className="command-input-icon">⌘</span>
          <input
            type="text"
            className="command-input"
            placeholder="Type a command... (e.g., check emails, find jobs)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {input && (
            <button className="command-clear" onClick={() => setInput("")}>
              ✕
            </button>
          )}
        </div>

        <div className="command-results">
          {filteredCommands.length === 0 ? (
            <div className="command-empty">
              <p>No commands found</p>
              <small>Try searching for "email", "quote", "jobs", etc.</small>
            </div>
          ) : (
            <>
              <div className="command-list">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.id}
                    className={`command-item ${index === selectedIndex ? "selected" : ""} ${
                      executing ? "disabled" : ""
                    }`}
                    onClick={() => executeCommand(command)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="command-icon">{command.icon}</div>
                    <div className="command-content">
                      <div className="command-name">{command.name}</div>
                      <div className="command-description">{command.description}</div>
                      <div className="command-category">{command.category}</div>
                    </div>
                    <div className="command-priority">
                      <span
                        className={`priority-dot priority-${command.priority || "medium"}`}
                      />
                    </div>
                  </button>
                ))}
              </div>

              <div className="command-footer">
                <div className="command-hint">
                  <kbd>↑↓</kbd> to navigate • <kbd>Enter</kbd> to execute • <kbd>Esc</kbd> to close
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .command-palette-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .command-palette {
          position: fixed;
          top: 20%;
          left: 50%;
          transform: translateX(-50%);
          width: 90%;
          max-width: 600px;
          max-height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .command-input-container {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border-bottom: 2px solid #eee;
          background: white;
        }

        .command-input-icon {
          font-size: 16px;
          color: #999;
        }

        .command-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 16px;
          font-family: inherit;
          color: #333;
        }

        .command-input::placeholder {
          color: #999;
        }

        .command-clear {
          background: none;
          border: none;
          font-size: 16px;
          color: #999;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .command-clear:hover {
          color: #333;
        }

        .command-results {
          flex: 1;
          overflow-y: auto;
          min-height: 100px;
        }

        .command-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          color: #999;
          text-align: center;
        }

        .command-empty p {
          margin: 0 0 8px 0;
          font-weight: 500;
        }

        .command-empty small {
          margin: 0;
          font-size: 12px;
        }

        .command-list {
          display: flex;
          flex-direction: column;
        }

        .command-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: white;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
          border-left: 3px solid transparent;
        }

        .command-item:hover {
          background: #f9f9f9;
        }

        .command-item.selected {
          background: #f0f0f0;
          border-left-color: #667eea;
        }

        .command-item.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .command-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .command-content {
          flex: 1;
          min-width: 0;
        }

        .command-name {
          font-weight: 600;
          font-size: 14px;
          color: #333;
          margin-bottom: 2px;
        }

        .command-description {
          font-size: 12px;
          color: #666;
          margin-bottom: 4px;
        }

        .command-category {
          font-size: 10px;
          color: #999;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .command-priority {
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .priority-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .priority-dot.priority-urgent {
          background: #ff0000;
        }

        .priority-dot.priority-high {
          background: #ff6b6b;
        }

        .priority-dot.priority-medium {
          background: #ffd93d;
        }

        .priority-dot.priority-low {
          background: #6bcf7f;
        }

        .command-footer {
          padding: 12px 16px;
          border-top: 1px solid #eee;
          background: #fafafa;
          display: flex;
          justify-content: flex-end;
        }

        .command-hint {
          font-size: 11px;
          color: #999;
          display: flex;
          gap: 4px;
        }

        kbd {
          display: inline-block;
          padding: 2px 6px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-family: monospace;
          font-size: 10px;
        }

        .command-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 12px 16px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          font-size: 14px;
          z-index: 10000;
          animation: slideUp 0.3s ease;
        }

        @media (max-width: 600px) {
          .command-palette {
            width: 95%;
            max-height: 70vh;
            top: 50%;
            transform: translate(-50%, -50%);
          }

          .command-input {
            font-size: 14px;
          }
        }
      `}</style>
    </>
  );
}

export default CommandPalette;

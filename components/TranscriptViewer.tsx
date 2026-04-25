"use client";

import React, { useState } from "react";

export interface Transcript {
  id: string;
  text: string;
  originalText?: string;
  createdAt: Date;
  isEditing?: boolean;
  confidence?: number;
}

interface TranscriptViewerProps {
  transcript: Transcript;
  onSave?: (updatedTranscript: string) => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export function TranscriptViewer({
  transcript,
  onSave,
  onDelete,
  readOnly = false,
}: TranscriptViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(transcript.text);
  const [selectedText, setSelectedText] = useState("");
  const [highlights, setHighlights] = useState<Array<{ start: number; end: number; color: string }>>([]);

  const handleEdit = () => {
    if (readOnly) return;
    setIsEditing(true);
    setEditedText(transcript.text);
  };

  const handleSave = () => {
    if (editedText.trim()) {
      onSave?.(editedText);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedText(transcript.text);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editedText || transcript.text);
  };

  const handleHighlight = (color: string) => {
    if (!selectedText) return;

    const start = (editedText || transcript.text).indexOf(selectedText);
    if (start !== -1) {
      const end = start + selectedText.length;
      setHighlights((prev) => [...prev, { start, end, color }]);
    }

    setSelectedText("");
  };

  const handleClearHighlights = () => {
    setHighlights([]);
  };

  const getHighlightedText = () => {
    const text = editedText || transcript.text;
    if (highlights.length === 0) return text;

    let result = [];
    let lastIndex = 0;

    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start);

    for (const hl of sortedHighlights) {
      if (hl.start > lastIndex) {
        result.push(text.substring(lastIndex, hl.start));
      }
      result.push(
        `<span style="background: ${hl.color}; padding: 2px 4px;">${text.substring(
          hl.start,
          hl.end
        )}</span>`
      );
      lastIndex = hl.end;
    }

    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }

    return result.join("");
  };

  const confidenceColor =
    transcript.confidence! >= 80 ? "#4caf50" : transcript.confidence! >= 60 ? "#ffc107" : "#ff6b6b";

  return (
    <div className="transcript-viewer">
      <div className="viewer-header">
        <div className="header-title">
          <h3>📄 Transcript</h3>
          <span className="timestamp">
            {transcript.createdAt.toLocaleTimeString()}
          </span>
        </div>

        {transcript.confidence && (
          <div className="confidence-indicator">
            <div className="confidence-circle" style={{ backgroundColor: confidenceColor }} />
            <span className="confidence-text">{transcript.confidence}% accuracy</span>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="editor-mode">
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            className="transcript-textarea"
            placeholder="Edit transcript..."
          />

          <div className="editor-toolbar">
            <button className="btn btn-secondary" onClick={handleCancel}>
              ✕ Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              ✓ Save Changes
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="viewer-mode">
            <div className="transcript-content">
              <div
                className="transcript-text"
                onMouseUp={() => {
                  const selected = window.getSelection()?.toString();
                  if (selected) setSelectedText(selected);
                }}
              >
                {transcript.text}
              </div>
            </div>

            {selectedText && (
              <div className="selection-toolbar">
                <div className="selection-preview">
                  <span>"{selectedText.substring(0, 50)}"</span>
                </div>
                <div className="highlight-buttons">
                  <button
                    className="highlight-btn yellow"
                    onClick={() => handleHighlight("#fff9c4")}
                    title="Highlight in yellow"
                  >
                    🟨
                  </button>
                  <button
                    className="highlight-btn green"
                    onClick={() => handleHighlight("#c8e6c9")}
                    title="Highlight in green"
                  >
                    🟩
                  </button>
                  <button
                    className="highlight-btn blue"
                    onClick={() => handleHighlight("#bbdefb")}
                    title="Highlight in blue"
                  >
                    🟦
                  </button>
                  <button
                    className="highlight-btn red"
                    onClick={() => handleHighlight("#ffcdd2")}
                    title="Highlight in red"
                  >
                    🟥
                  </button>
                </div>
              </div>
            )}

            {highlights.length > 0 && (
              <div className="highlights-list">
                <div className="highlights-header">
                  <span>{highlights.length} highlight{highlights.length !== 1 ? "s" : ""}</span>
                  <button
                    className="btn-clear"
                    onClick={handleClearHighlights}
                  >
                    Clear all
                  </button>
                </div>
                {highlights.map((hl, idx) => (
                  <div key={idx} className="highlight-item" style={{ backgroundColor: hl.color }}>
                    "{transcript.text.substring(hl.start, hl.end)}"
                  </div>
                ))}
              </div>
            )}

            <div className="viewer-toolbar">
              {!readOnly && (
                <button className="btn btn-secondary" onClick={handleEdit}>
                  ✏️ Edit
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleCopy}>
                📋 Copy
              </button>
              {onDelete && (
                <button className="btn btn-danger" onClick={onDelete}>
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .transcript-viewer {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          max-width: 100%;
        }

        .viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f0f0f0;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-title h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .timestamp {
          font-size: 12px;
          color: #999;
        }

        .confidence-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #666;
        }

        .confidence-circle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .transcript-content {
          margin-bottom: 16px;
        }

        .transcript-text {
          background: #f9f9f9;
          padding: 16px;
          border-radius: 6px;
          line-height: 1.8;
          font-size: 14px;
          color: #333;
          white-space: pre-wrap;
          word-break: break-word;
          user-select: text;
          cursor: text;
          min-height: 120px;
        }

        .viewer-mode {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .editor-mode {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .transcript-textarea {
          padding: 12px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: "Courier New", monospace;
          font-size: 13px;
          color: #333;
          resize: vertical;
          min-height: 200px;
        }

        .transcript-textarea:focus {
          outline: none;
          border-color: #4171ff;
          box-shadow: 0 0 0 3px rgba(65, 113, 255, 0.1);
        }

        .selection-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: #e3f2fd;
          border-radius: 6px;
          font-size: 12px;
        }

        .selection-preview {
          flex: 1;
          color: #1976d2;
          font-style: italic;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .highlight-buttons {
          display: flex;
          gap: 6px;
        }

        .highlight-btn {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          transition: all 0.2s ease;
          opacity: 0.7;
        }

        .highlight-btn:hover {
          opacity: 1;
          transform: scale(1.15);
        }

        .highlights-list {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .highlights-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #666;
        }

        .btn-clear {
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 11px;
          text-decoration: underline;
          transition: all 0.2s ease;
        }

        .btn-clear:hover {
          color: #666;
        }

        .highlight-item {
          padding: 8px;
          border-radius: 4px;
          margin-bottom: 6px;
          font-size: 12px;
          line-height: 1.5;
          word-break: break-word;
        }

        .highlight-item:last-child {
          margin-bottom: 0;
        }

        .viewer-toolbar,
        .editor-toolbar {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 12px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          flex: 1;
        }

        .btn-primary {
          background: #4171ff;
          color: white;
        }

        .btn-primary:hover {
          background: #2e5dd9;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #d0d0d0;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        .btn-danger {
          background: #ffebee;
          color: #c62828;
          border: 1px solid #ff6b6b;
        }

        .btn-danger:hover {
          background: #ffcdd2;
        }

        @media (max-width: 768px) {
          .viewer-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .selection-toolbar {
            flex-direction: column;
            align-items: flex-start;
          }

          .highlight-buttons {
            width: 100%;
            justify-content: space-around;
          }

          .transcript-textarea {
            min-height: 150px;
          }

          .btn {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default TranscriptViewer;

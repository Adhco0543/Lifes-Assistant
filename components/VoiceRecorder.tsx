"use client";

import React, { useState, useRef, useEffect } from "react";

export interface VoiceRecording {
  id: string;
  userId: string;
  audioBlob: Blob;
  audioUrl: string;
  transcript?: string;
  duration: number;
  createdAt: Date;
  isTranscribing: boolean;
  confidence?: number;
}

interface VoiceRecorderProps {
  userId: string;
  onTranscriptReady?: (transcript: string, recording: VoiceRecording) => void;
  onRecordingComplete?: (recording: VoiceRecording) => void;
  autoTranscribe?: boolean;
}

export function VoiceRecorder({
  userId,
  onTranscriptReady,
  onRecordingComplete,
  autoTranscribe = true,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        const recording: VoiceRecording = {
          id: `recording_${Date.now()}`,
          userId,
          audioBlob,
          audioUrl,
          duration,
          createdAt: new Date(),
          isTranscribing: autoTranscribe,
        };

        setRecordings((prev) => [recording, ...prev]);
        onRecordingComplete?.(recording);

        if (autoTranscribe) {
          await transcribeAudio(recording);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to access microphone"
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const transcribeAudio = async (recording: VoiceRecording) => {
    try {
      setIsTranscribing(true);

      // Create FormData for Whisper API
      const formData = new FormData();
      formData.append("file", recording.audioBlob, "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "en");

      // Call OpenAI Whisper API
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Transcription failed");

      const data = (await response.json()) as { text?: string; confidence?: number };
      const transcribedText = data.text || "";

      setTranscript(transcribedText);

      // Update recording with transcript
      const updatedRecording: VoiceRecording = {
        ...recording,
        transcript: transcribedText,
        isTranscribing: false,
        confidence: data.confidence,
      };

      setRecordings((prev) =>
        prev.map((r) =>
          r.id === recording.id ? updatedRecording : r
        )
      );

      onTranscriptReady?.(transcribedText, updatedRecording);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const deleteRecording = (id: string) => {
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="voice-recorder">
      <div className="recorder-card">
        <h3>🎙️ Voice Recording</h3>

        <div className="recorder-control">
          <div className="timer">{formatTime(duration)}</div>
          {isRecording ? (
            <button
              className="btn btn-stop"
              onClick={stopRecording}
            >
              ⏹️ Stop Recording
            </button>
          ) : (
            <button
              className="btn btn-start"
              onClick={startRecording}
              disabled={isTranscribing}
            >
              🎤 Start Recording
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {isTranscribing && (
          <div className="transcribing-status">
            <div className="spinner"></div>
            <p>Transcribing audio...</p>
          </div>
        )}

        {transcript && (
          <div className="transcript-display">
            <h4>📝 Transcript</h4>
            <div className="transcript-text">
              <p>{transcript}</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(transcript);
              }}
            >
              📋 Copy Transcript
            </button>
          </div>
        )}
      </div>

      {recordings.length > 0 && (
        <div className="recordings-list">
          <h4>📚 Recording History ({recordings.length})</h4>
          {recordings.map((recording) => (
            <div key={recording.id} className="recording-item">
              <div className="recording-info">
                <div className="recording-time">
                  {recording.createdAt.toLocaleTimeString()}
                </div>
                <div className="recording-duration">
                  {formatTime(recording.duration)}
                </div>
                {recording.transcript && (
                  <div className="recording-preview">
                    {recording.transcript.substring(0, 80)}...
                  </div>
                )}
              </div>
              <div className="recording-actions">
                <audio controls src={recording.audioUrl} />
                <button
                  className="btn-delete"
                  onClick={() => deleteRecording(recording.id)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .voice-recorder {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .recorder-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .recorder-card h3 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .recorder-control {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 16px;
        }

        .timer {
          font-size: 28px;
          font-weight: 700;
          color: #ff6b6b;
          font-family: "Courier New", monospace;
          min-width: 100px;
          text-align: center;
        }

        .btn {
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .btn-start {
          background: #4caf50;
          color: white;
          flex: 1;
        }

        .btn-start:hover:not(:disabled) {
          background: #45a049;
        }

        .btn-start:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-stop {
          background: #ff6b6b;
          color: white;
          flex: 1;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .btn-stop:hover {
          background: #ff5252;
        }

        .btn-secondary {
          background: #f0f0f0;
          color: #333;
          border: 1px solid #d0d0d0;
          padding: 8px 12px;
          font-size: 12px;
        }

        .btn-secondary:hover {
          background: #e0e0e0;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          border-left: 3px solid #ff6b6b;
          color: #c62828;
          font-size: 13px;
          border-radius: 4px;
          margin-bottom: 12px;
        }

        .transcribing-status {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #e3f2fd;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #f0f0f0;
          border-top-color: #2196f3;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .transcribing-status p {
          margin: 0;
          font-size: 13px;
          color: #1976d2;
          font-weight: 600;
        }

        .transcript-display {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .transcript-display h4 {
          margin: 0 0 8px;
          font-size: 12px;
          font-weight: 600;
          color: #666;
        }

        .transcript-text {
          background: white;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 10px;
          font-size: 13px;
          line-height: 1.6;
          color: #333;
        }

        .transcript-text p {
          margin: 0;
        }

        .recordings-list {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
        }

        .recordings-list h4 {
          margin: 0 0 12px;
          font-size: 14px;
          font-weight: 600;
          color: #333;
        }

        .recording-item {
          display: flex;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          margin-bottom: 8px;
          align-items: center;
        }

        .recording-item:last-child {
          margin-bottom: 0;
        }

        .recording-info {
          flex: 1;
          min-width: 0;
        }

        .recording-time {
          font-size: 12px;
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
        }

        .recording-duration {
          font-size: 11px;
          color: #999;
          margin-bottom: 4px;
        }

        .recording-preview {
          font-size: 11px;
          color: #666;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .recording-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .recording-actions audio {
          height: 24px;
          max-width: 200px;
        }

        .btn-delete {
          background: transparent;
          border: none;
          font-size: 16px;
          cursor: pointer;
          padding: 4px;
          transition: all 0.2s ease;
        }

        .btn-delete:hover {
          transform: scale(1.1);
        }

        @media (max-width: 768px) {
          .recorder-control {
            flex-direction: column;
            gap: 10px;
          }

          .timer {
            width: 100%;
          }

          .btn {
            width: 100%;
          }

          .recording-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .recording-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .recording-actions audio {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

export default VoiceRecorder;

'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';
import { TRANSCRIPTION_AUDIO_FIELD, transcriptionFileName } from '../lib/transcriptionContracts';

type CaptureStatus = 'idle' | 'starting' | 'recording' | 'transcribing' | 'review';

export default function HoldToTalk({ onUseTranscript }: { onUseTranscript: (text: string) => void }) {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'unavailable'>('unknown');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const pressedRef = useRef(false);
  const cancelledRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const clickSuppressionRef = useRef(false);
  const captureSequenceRef = useRef(0);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => () => {
    captureSequenceRef.current += 1;
    pressedRef.current = false;
    cancelledRef.current = true;
    abortRef.current?.abort();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    stopTracks();
  }, []);

  const enableMicrophone = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setPermission('unavailable');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
    } catch {
      setPermission('unavailable');
      setError('Microphone access was not granted. You can still type normally.');
    }
  };

  const startRecording = async () => {
    if (status !== 'idle' || !pressedRef.current) return;
    const requestSequence = ++captureSequenceRef.current;
    cancelledRef.current = false;
    setError('');
    setTranscript('');
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requestSequence !== captureSequenceRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (!pressedRef.current || cancelledRef.current) {
        stopTracks();
        setStatus('idle');
        return;
      }

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find((candidate) => MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stopTracks();
        recorderRef.current = null;
        if (cancelledRef.current) {
          chunksRef.current = [];
          setStatus('idle');
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (!blob.size) {
          setError('No audio was captured. Hold the button while speaking and try again.');
          setStatus('idle');
          return;
        }
        void transcribe(blob);
      };
      recorder.start();
      setStatus('recording');
      if (!pressedRef.current) recorder.stop();
    } catch {
      stopTracks();
      setStatus('idle');
      setPermission('unavailable');
      setError('Could not start microphone recording. You can still type normally.');
    }
  };

  const stopRecording = () => {
    pressedRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    else if (status === 'starting') setStatus('idle');
  };

  const cancelCapture = () => {
    captureSequenceRef.current += 1;
    pressedRef.current = false;
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    stopTracks();
    chunksRef.current = [];
    setTranscript('');
    setError('');
    setStatus('idle');
  };

  const transcribe = async (blob: Blob) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('transcribing');
    try {
      const formData = new FormData();
      formData.append(TRANSCRIPTION_AUDIO_FIELD, blob, transcriptionFileName(blob.type));
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Sign in before transcribing audio.');
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: { Authorization: ['Bear', 'er ', token].join('') },
      });
      const result = await response.json().catch(() => null) as { text?: unknown; error?: unknown } | null;
      if (!response.ok || typeof result?.text !== 'string' || !result.text.trim()) {
        throw new Error(typeof result?.error === 'string' ? result.error : 'Transcription failed.');
      }
      if (!cancelledRef.current) {
        setTranscript(result.text.slice(0, 2000));
        setStatus('review');
      }
    } catch (reason) {
      if (!controller.signal.aborted && !cancelledRef.current) {
        setError(reason instanceof Error ? reason.message.slice(0, 180) : 'Transcription failed. Try again or type your message.');
        setStatus('idle');
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const onPressStart = (event: PointerEvent<HTMLButtonElement>) => {
    if (permission !== 'granted' || status !== 'idle') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pressedRef.current = true;
    void startRecording();
  };

  const onPressEnd = () => {
    if (!pressedRef.current) return;
    stopRecording();
  };

  const onKeyStart = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === ' ' || event.key === 'Enter') && permission === 'granted' && status === 'idle') {
      event.preventDefault();
      pressedRef.current = true;
      clickSuppressionRef.current = true;
      void startRecording();
    }
  };

  const onKeyEnd = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      onPressEnd();
      window.setTimeout(() => { clickSuppressionRef.current = false; }, 0);
    }
  };

  return (
    <div className="voice-capture">
      {permission !== 'granted' ? (
        <button type="button" className="voice-permission" onClick={() => void enableMicrophone()}>
          Enable microphone
        </button>
      ) : (
        <button
          type="button"
          className="voice-hold"
          aria-pressed={status === 'recording' || status === 'starting'}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={cancelCapture}
          onLostPointerCapture={onPressEnd}
          onKeyDown={onKeyStart}
          onKeyUp={onKeyEnd}
          onClick={(event) => {
            if (event.detail !== 0 || clickSuppressionRef.current) return;
            if (pressedRef.current) stopRecording();
            else {
              pressedRef.current = true;
              void startRecording();
            }
          }}
          disabled={status === 'transcribing' || status === 'review'}
        >
          {status === 'recording' || status === 'starting' ? 'Release to transcribe' : 'Hold to talk'}
        </button>
      )}
      {(status === 'recording' || status === 'transcribing') && (
        <button type="button" className="voice-cancel" onClick={cancelCapture}>
          {status === 'recording' ? 'Cancel recording' : 'Cancel transcription'}
        </button>
      )}
      {status === 'starting' && <span role="status">Starting microphone…</span>}
      {status === 'recording' && <span role="status" aria-live="polite">Recording. Release to review your words.</span>}
      {status === 'transcribing' && <span role="status">Transcribing…</span>}
      {permission === 'unavailable' && <span>Voice capture is unavailable in this browser. You can still type.</span>}
      {error && <span className="voice-error" role="alert">{error}</span>}
      {status === 'review' && (
        <div className="voice-review">
          <label>
            Review and edit the transcription before using it
            <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={3} />
          </label>
          <div>
            <button type="button" onClick={() => { onUseTranscript(transcript.trim()); setTranscript(''); setStatus('idle'); }} disabled={!transcript.trim()}>
              Use this text
            </button>
            <button type="button" onClick={() => { setTranscript(''); setStatus('idle'); }}>Discard</button>
          </div>
        </div>
      )}
      <style jsx>{`
        .voice-capture { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; color: #aaa; font-size: .72rem; }
        .voice-capture button { min-height: 36px; border: 1px solid #444; border-radius: 9px; padding: 0 12px; background: #292929; color: #ddd; font: inherit; cursor: pointer; }
        .voice-capture button:disabled { opacity: .5; cursor: default; }
        .voice-hold { touch-action: none; user-select: none; }
        .voice-hold[aria-pressed="true"] { border-color: #b65b5b; background: #382323; color: #ffe4e4; }
        .voice-cancel { color: #e4c9c9 !important; }
        .voice-error { color: #ffaaaa; }
        .voice-review { display: grid; gap: 8px; width: 100%; padding: 12px; border: 1px solid #383838; border-radius: 10px; background: #252525; }
        .voice-review label { display: grid; gap: 7px; color: #ccc; }
        .voice-review textarea { width: 100%; min-height: 76px; resize: vertical; border: 1px solid #444; border-radius: 8px; padding: 9px; background: #1d1d1d; color: #eee; font: inherit; line-height: 1.5; }
        .voice-review > div { display: flex; flex-wrap: wrap; gap: 8px; }
        .voice-review > div button:first-child { background: #ededed; color: #151515; }
        @media (max-width: 520px) { .voice-review > div button { flex: 1; } }
      `}</style>
    </div>
  );
}

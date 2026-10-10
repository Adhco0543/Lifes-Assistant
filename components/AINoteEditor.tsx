'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

interface AINoteEditorProps {
  userId: string;
}

type SavedNote = {
  id: string;
  text: string;
  createdAt: number;
  projectId?: string;
  projectName?: string;
  cloud?: boolean;
};

type ProjectOption = {
  id: string;
  name: string;
};

type ChatResponse = {
  message?: string;
};

export const AINoteEditor: React.FC<AINoteEditorProps> = ({ userId }) => {
  const storageKey = `lifes-assistant-notes:${userId}`;
  const [instructions, setInstructions] = useState('');
  const [note, setNote] = useState('');
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState<'checking' | 'cloud' | 'local'>('checking');

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      try {
        const records = await firebaseBackend.getRecentBusinessRecords(100);
        if (!active) return;

        const projectOptions: ProjectOption[] = records
          .filter((record) => record.kind === 'project')
          .map((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            return {
              id: String(record.id || ''),
              name: String(data.name || '').trim(),
            };
          })
          .filter((project) => project.id && project.name);

        setProjects(projectOptions);

        const cloudNotes: SavedNote[] = records
          .filter((record) => record.kind === 'note')
          .map((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            return {
              id: String(record.id),
              text: String(data.text || ''),
              createdAt: Number(record.createdAt || Date.now()),
              projectId: typeof data.projectId === 'string' ? data.projectId : '',
              projectName: typeof data.projectName === 'string' ? data.projectName : '',
              cloud: true,
            };
          })
          .filter((item) => item.text);

        const recovered: SavedNote[] = [];
        try {
          const rawLocal = localStorage.getItem(storageKey);
          const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
          if (Array.isArray(parsedLocal)) {
            for (const localNote of parsedLocal as SavedNote[]) {
              if (!localNote?.text || localNote.cloud) continue;
              const id = await firebaseBackend.saveBusinessRecord('note', {
                text: localNote.text,
                projectId: localNote.projectId || '',
                projectName: localNote.projectName || '',
              });
              recovered.push({ ...localNote, id, cloud: true });
            }
            if (recovered.length) {
              localStorage.removeItem(storageKey);
            }
          }
        } catch (error) {
          console.warn('Could not migrate local notes to cloud:', error);
        }

        setSavedNotes([...recovered, ...cloudNotes]);
        setMode('cloud');
        if (recovered.length) {
          setStatus(`Recovered ${recovered.length} local note${recovered.length === 1 ? '' : 's'} into your cloud workspace.`);
        }
      } catch {
        try {
          const stored = localStorage.getItem(storageKey);
          setSavedNotes(stored ? JSON.parse(stored) : []);
        } catch {
          setSavedNotes([]);
        }
        setMode('local');
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [storageKey]);

  const persistLocal = (notes: SavedNote[]) => {
    setSavedNotes(notes);
    localStorage.setItem(storageKey, JSON.stringify(notes));
  };

  const generateNote = async () => {
    if (!instructions.trim()) {
      setStatus('Tell the assistant what you want captured first.');
      return;
    }

    setIsGenerating(true);
    setStatus('');

    try {
      const token = await firebaseBackend.getIdToken();
      if (!token) throw new Error('Authentication required');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          message:
            `Turn this into a concise useful note with clear facts and next steps. Do not claim that anyone was notified or contacted. Input: ${instructions}`,
          businessContext: 'note-organizing',
          chatbotName: "Life's Assistant",
        }),
      });

      if (!response.ok) {
        throw new Error(`AI request failed with status ${response.status}`);
      }

      const data = (await response.json()) as ChatResponse;
      setNote(data.message?.trim() || instructions.trim());
      setStatus('Note prepared. Review it, then save it if you want to keep it.');
    } catch (error) {
      setNote(instructions.trim());
      setStatus(error instanceof Error ? `AI unavailable: ${error.message}. Your original note is still here.` : 'AI unavailable. Your original note is still here.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveNote = async () => {
    const text = note.trim();
    if (!text) {
      setStatus('There is no note to save yet.');
      return;
    }

    if (mode === 'cloud') {
      try {
        const selectedProject = projects.find((project) => project.id === projectId);
        const projectName = selectedProject?.name || '';

        const id = await firebaseBackend.saveBusinessRecord('note', {
          text,
          projectId,
          projectName,
        });
        await firebaseBackend.trackEvent('note.saved', {
          recordId: id,
          preview: text.slice(0, 120),
          projectId,
          projectName,
        });
        setSavedNotes((current) => [
          { id, text, createdAt: Date.now(), projectId, projectName, cloud: true },
          ...current,
        ]);
        setStatus('Note saved to your cloud workspace.');
        return;
      } catch {
        setMode('local');
      }
    }

    const next = [
      {
        id: 'local-' + Date.now(),
        text,
        createdAt: Date.now(),
        projectId,
        projectName: projects.find((project) => project.id === projectId)?.name || '',
        cloud: false,
      },
      ...savedNotes,
    ];
    persistLocal(next);
    setStatus('Note saved on this device because cloud sync is unavailable.');
  };

  const removeNote = async (item: SavedNote) => {
    if (mode === 'cloud' && item.cloud) {
      try {
        await firebaseBackend.deleteBusinessRecord(item.id);
        setSavedNotes((current) => current.filter((noteItem) => noteItem.id !== item.id));
        return;
      } catch {
        setStatus('Could not delete the cloud note.');
        return;
      }
    }

    persistLocal(savedNotes.filter((noteItem) => noteItem.id !== item.id));
  };

  const copyNote = async () => {
    if (!note.trim()) return;
    try {
      await navigator.clipboard.writeText(note);
      setStatus('Note copied.');
    } catch {
      setStatus('Clipboard access was blocked by the browser.');
    }
  };

  return (
    <div className="notes-page">
      <div className="notes-inner">
        <header>
          <span className="eyebrow">NOTES</span>
          <h1>Capture it before it disappears.</h1>
          <p>AI can organize your rough note. Saved notes follow your signed-in workspace when cloud storage is available.</p>
        </header>

        <div className="grid">
          <section className="panel">
            <div className="panel-title">
              <span className="eyebrow">CAPTURE</span>
              <h2>What do you need to remember?</h2>
            </div>

            <textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Example: Customer wants the porch estimate by Friday. Need to check lumber pricing and call before 3 PM."
            />

            <button className="primary" onClick={generateNote} disabled={isGenerating}>
              {isGenerating ? 'Organizing…' : 'Organize with AI'}
            </button>

            <div className="truth-note">
              <strong>Notification status</strong>
              <p>No email, text, or push notification is sent from this screen yet.</p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">
              <span className="eyebrow">WORKING NOTE</span>
              <h2>Edit before saving</h2>
            </div>

            <textarea
              className="note-editor"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Your organized note will appear here."
            />

            <label className="project-field">
              <span>Project</span>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>

            <div className="actions">
              <button className="secondary" onClick={copyNote} disabled={!note.trim()}>Copy</button>
              <button className="primary" onClick={saveNote} disabled={!note.trim()}>Save note</button>
            </div>

            {status && <div className="status" role="status">{status}</div>}
          </section>
        </div>

        <section className="saved-panel">
          <div className="saved-heading">
            <div>
              <span className="eyebrow">SAVED</span>
              <h2>Your recent notes</h2>
            </div>
            <span className="count">{savedNotes.length}</span>
          </div>

          {savedNotes.length === 0 ? (
            <div className="empty">No saved notes yet.</div>
          ) : (
            <div className="saved-list">
              {savedNotes.map((item) => (
                <article key={item.id} className="saved-note">
                  <div>
                    <p>{item.text}</p>
                    <small>
                      {item.projectName ? item.projectName + ' · ' : ''}
                      {new Date(item.createdAt).toLocaleString()}
                    </small>
                  </div>
                  <button onClick={() => removeNote(item)} aria-label="Delete note">×</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .notes-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .notes-inner { width: min(1080px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { margin-bottom: 24px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; color: #858585; max-width: 760px; line-height: 1.55; font-size: .8rem; }
        .grid { display: grid; grid-template-columns: .9fr 1.1fr; gap: 12px; }
        .panel, .saved-panel { border: 1px solid #343434; background: #262626; border-radius: 17px; }
        .panel { padding: 20px; display: grid; gap: 14px; align-content: start; }
        .panel-title h2, .saved-heading h2 { margin: 5px 0 0; font-size: 1rem; }
        textarea { width: 100%; min-height: 180px; border: 1px solid #414141; border-radius: 10px; background: #1f1f1f; color: #f2f2f2; padding: 12px; outline: none; resize: vertical; line-height: 1.5; }
        textarea::placeholder { color: #676767; }
        textarea:focus { border-color: #666; box-shadow: 0 0 0 3px rgba(255,255,255,.04); }
        .note-editor { min-height: 260px; }
        .project-field { display: grid; gap: 6px; }
        .project-field span { color: #bdbdbd; font-size: .7rem; font-weight: 650; }
        .project-field select { min-height: 40px; border: 1px solid #414141; border-radius: 10px; background: #1f1f1f; color: #ededed; padding: 0 10px; }
        button { min-height: 42px; border-radius: 10px; padding: 0 14px; font-weight: 650; cursor: pointer; }
        .primary { border: 0; background: #ededed; color: #111; }
        .secondary { border: 1px solid #454545; background: #303030; color: #ededed; }
        button:disabled { opacity: .4; cursor: default; }
        .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .truth-note { padding: 13px; border: 1px solid rgba(143,196,255,.22); background: rgba(143,196,255,.04); border-radius: 12px; }
        .truth-note strong { font-size: .73rem; }
        .truth-note p { margin: 4px 0 0; color: #748597; font-size: .67rem; line-height: 1.45; }
        .status { color: #9b9b9b; background: #222; border: 1px solid #343434; border-radius: 10px; padding: 10px 12px; font-size: .7rem; }
        .saved-panel { margin-top: 12px; padding: 20px; }
        .saved-heading { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .count { min-width: 30px; height: 25px; padding: 0 8px; border-radius: 999px; display: grid; place-items: center; background: #303030; color: #8b8b8b; font-size: .67rem; }
        .empty { min-height: 100px; display: grid; place-items: center; color: #6f6f6f; font-size: .73rem; }
        .saved-list { display: grid; gap: 8px; }
        .saved-note { display: grid; grid-template-columns: minmax(0,1fr) 30px; gap: 10px; align-items: start; padding: 12px; border: 1px solid #343434; background: #2b2b2b; border-radius: 11px; }
        .saved-note p { margin: 0; white-space: pre-wrap; color: #cfcfcf; font-size: .73rem; line-height: 1.45; }
        .saved-note small { display: block; margin-top: 6px; color: #646464; font-size: .61rem; }
        .saved-note button { min-height: 28px; height: 28px; padding: 0; border: 0; background: transparent; color: #686868; font-size: 1rem; }
        @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) {
          .notes-inner { width: calc(100% - 28px); padding-top: 24px; }
          .actions { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AINoteEditor;

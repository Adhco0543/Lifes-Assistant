'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type ProjectStatus = 'active' | 'paused' | 'done';

type Project = {
  id: string;
  name: string;
  goal: string;
  notes: string;
  status: ProjectStatus;
  createdAt: number;
};

export default function ProjectsCenter() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [statusValue, setStatusValue] = useState<ProjectStatus>('active');
  const [status, setStatus] = useState('Loading projects…');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const records = await firebaseBackend.getRecentBusinessRecords(200);
      const next = records
        .filter((record) => record.kind === 'project')
        .map((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          const projectStatus =
            data.status === 'paused' || data.status === 'done' ? data.status : 'active';

          return {
            id: String(record.id || ''),
            name: String(data.name || ''),
            goal: String(data.goal || ''),
            notes: String(data.notes || ''),
            status: projectStatus as ProjectStatus,
            createdAt: Number(record.createdAt || Date.now()),
          };
        })
        .filter((project) => project.name)
        .sort((a, b) => {
          const rank: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2 };
          return rank[a.status] - rank[b.status] || b.createdAt - a.createdAt;
        });

      setProjects(next);
      setStatus(next.length ? next.length + ' projects saved.' : 'No projects saved yet.');
    } catch {
      setProjects([]);
      setStatus('Projects could not be loaded from the cloud workspace.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      const id = await firebaseBackend.saveBusinessRecord('project', {
        name: name.trim(),
        goal: goal.trim(),
        notes: notes.trim(),
        status: statusValue,
      });

      await firebaseBackend.trackEvent('project.saved', {
        recordId: id,
        name: name.trim(),
        status: statusValue,
      });

      setProjects((current) => [
        {
          id,
          name: name.trim(),
          goal: goal.trim(),
          notes: notes.trim(),
          status: statusValue,
          createdAt: Date.now(),
        },
        ...current,
      ]);

      setName('');
      setGoal('');
      setNotes('');
      setStatusValue('active');
      setStatus('Project saved to your workspace.');
    } catch {
      setStatus('That project could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (project: Project, nextStatus: ProjectStatus) => {
    try {
      await firebaseBackend.updateBusinessRecord(project.id, {
        name: project.name,
        goal: project.goal,
        notes: project.notes,
        status: nextStatus,
      });

      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? { ...item, status: nextStatus } : item
        )
      );

      await firebaseBackend.trackEvent('project.status', {
        recordId: project.id,
        name: project.name,
        status: nextStatus,
      });

      setStatus(project.name + ' marked ' + nextStatus + '.');
    } catch {
      setStatus('Could not update that project.');
    }
  };

  const remove = async (project: Project) => {
    try {
      await firebaseBackend.deleteBusinessRecord(project.id);
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setStatus(project.name + ' was removed.');
    } catch {
      setStatus('Could not remove that project.');
    }
  };

  return (
    <div className="page">
      <div className="inner">
        <header>
          <span className="eyebrow">PROJECTS</span>
          <h1>Keep the whole thing together.</h1>
          <p>
            A project gives Life&apos;s Assistant durable context around a goal, job, idea, event, or plan that lasts longer than one conversation.
          </p>
        </header>

        <section className="capture">
          <div className="top-grid">
            <label>
              <span>Project name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Launch Life’s Assistant" maxLength={100} />
            </label>
            <label>
              <span>Status</span>
              <select value={statusValue} onChange={(event) => setStatusValue(event.target.value as ProjectStatus)}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
              </select>
            </label>
          </div>

          <label>
            <span>Goal</span>
            <input value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What does finished look like?" maxLength={240} />
          </label>

          <label>
            <span>Context</span>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Useful details, constraints, decisions, or background…" maxLength={1600} />
          </label>

          <div className="capture-footer">
            <small>{status}</small>
            <button onClick={save} disabled={!name.trim() || saving}>{saving ? 'Saving…' : 'Create project'}</button>
          </div>
        </section>

        <section className="project-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">YOUR PROJECTS</span>
              <h2>{projects.length} total</h2>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty">
              <div>▦</div>
              <strong>No projects yet.</strong>
              <p>Create one above and use it as durable context for everything that belongs together.</p>
            </div>
          ) : (
            <div className="cards">
              {projects.map((project) => (
                <article key={project.id}>
                  <div className="project-top">
                    <span className={'status-pill ' + project.status}>{project.status}</span>
                    <button className="remove" onClick={() => remove(project)}>Remove</button>
                  </div>
                  <h3>{project.name}</h3>
                  {project.goal && <p className="goal">{project.goal}</p>}
                  {project.notes && <p className="notes">{project.notes}</p>}
                  <div className="status-actions">
                    {(['active', 'paused', 'done'] as ProjectStatus[]).map((value) => (
                      <button
                        key={value}
                        className={project.status === value ? 'selected' : ''}
                        onClick={() => changeStatus(project, value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .inner { width: min(1040px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 760px; color: #858585; font-size: .8rem; line-height: 1.55; }
        .capture, .project-section { margin-top: 18px; padding: 18px; border: 1px solid #343434; border-radius: 17px; background: #262626; }
        .capture { display: grid; gap: 12px; }
        .top-grid { display: grid; grid-template-columns: minmax(0,1fr) 150px; gap: 10px; }
        label { display: grid; gap: 7px; }
        label > span { color: #bdbdbd; font-size: .7rem; font-weight: 650; }
        input, textarea, select { width: 100%; border: 1px solid #414141; border-radius: 10px; background: #1f1f1f; color: #ededed; outline: 0; padding: 11px 12px; }
        textarea { min-height: 105px; resize: vertical; line-height: 1.45; }
        input:focus, textarea:focus, select:focus { border-color: #626262; }
        .capture-footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .capture-footer small { color: #6d6d6d; font-size: .63rem; }
        .capture-footer button { min-height: 40px; padding: 0 13px; border: 0; border-radius: 10px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .capture-footer button:disabled { opacity: .35; cursor: default; }
        .project-section { margin-top: 12px; }
        .section-head h2 { margin: 5px 0 12px; font-size: 1rem; }
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
        article { padding: 14px; border: 1px solid #343434; border-radius: 14px; background: #2b2b2b; }
        .project-top { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
        .status-pill { padding: 3px 7px; border-radius: 999px; font-size: .56rem; text-transform: uppercase; letter-spacing: .08em; background: #343434; color: #999; }
        .status-pill.active { color: #78d7a4; }
        .status-pill.paused { color: #dfbd72; }
        .status-pill.done { color: #888; }
        .remove { border: 0; background: transparent; color: #956f6f; font-size: .61rem; cursor: pointer; }
        h3 { margin: 12px 0 0; font-size: .88rem; }
        .goal { margin: 6px 0 0; color: #c0c0c0; font-size: .7rem; line-height: 1.45; }
        .notes { margin: 9px 0 0; color: #777; font-size: .65rem; line-height: 1.45; white-space: pre-wrap; }
        .status-actions { display: flex; gap: 5px; margin-top: 14px; padding-top: 10px; border-top: 1px solid #363636; }
        .status-actions button { min-height: 30px; padding: 0 8px; border: 1px solid #3d3d3d; border-radius: 8px; background: transparent; color: #777; font-size: .59rem; cursor: pointer; text-transform: capitalize; }
        .status-actions button.selected { background: #353535; color: #ddd; }
        .empty { min-height: 190px; display: grid; place-content: center; text-align: center; color: #707070; }
        .empty > div { width: 42px; height: 42px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 12px; background: #303030; }
        .empty strong { color: #bcbcbc; font-size: .78rem; }
        .empty p { max-width: 420px; margin: 5px auto 0; font-size: .65rem; line-height: 1.45; }
        @media (max-width: 720px) {
          .inner { width: calc(100% - 28px); padding-top: 24px; }
          .top-grid, .cards { grid-template-columns: 1fr; }
          .capture-footer { align-items: stretch; flex-direction: column; }
          .capture-footer button { width: 100%; }
        }
      `}</style>
    </div>
  );
}

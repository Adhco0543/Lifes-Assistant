'use client';

import React, { useEffect, useMemo, useState } from 'react';

interface TasksViewProps {
  userId: string;
}

type TaskStatus = 'open' | 'done';

type LocalTask = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
};

export const TasksView: React.FC<TasksViewProps> = ({ userId }) => {
  const storageKey = `lifes-assistant-tasks:${userId}`;
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const existing: LocalTask[] = saved ? JSON.parse(saved) : [];
      const rawDraft = localStorage.getItem('task_draft');

      if (rawDraft) {
        try {
          const draft = JSON.parse(rawDraft);
          if (typeof draft.title === 'string' && draft.title.trim()) {
            const handedOff: LocalTask = {
              id: `task-${Date.now()}`,
              title: draft.title.trim(),
              status: 'open',
              createdAt: Date.now(),
            };
            setTasks([handedOff, ...existing]);
            localStorage.removeItem('task_draft');
            setHydrated(true);
            return;
          }
        } catch {
          localStorage.removeItem('task_draft');
        }
      }

      setTasks(existing);
      setHydrated(true);
    } catch {
      setTasks([]);
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(tasks));
    } catch {
      // Local task storage is best-effort in the beta.
    }
  }, [hydrated, storageKey, tasks]);

  const openCount = useMemo(() => tasks.filter((task) => task.status === 'open').length, [tasks]);
  const doneCount = tasks.length - openCount;

  const addTask = () => {
    const title = draft.trim();
    if (!title) return;

    setTasks((current) => [
      { id: `task-${Date.now()}`, title, status: 'open', createdAt: Date.now() },
      ...current,
    ]);
    setDraft('');
  };

  const toggleTask = (id: string) => {
    setTasks((current) => current.map((task) => (
      task.id === id ? { ...task, status: task.status === 'open' ? 'done' : 'open' } : task
    )));
  };

  const removeTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  return (
    <div className="tasks-page">
      <div className="tasks-inner">
        <header className="page-header">
          <div>
            <span className="eyebrow">TASK CENTER</span>
            <h1>Keep the next move visible.</h1>
            <p>Capture work here now. Persistent background agent jobs will be added without pretending browser timers are 24/7 automation.</p>
          </div>
          <div className="stats">
            <div><strong>{openCount}</strong><span>Open</span></div>
            <div><strong>{doneCount}</strong><span>Done</span></div>
          </div>
        </header>

        <section className="capture-card">
          <div className="capture-icon">+</div>
          <div className="capture-copy">
            <label htmlFor="task-draft">Add something you do not want to lose</label>
            <div className="capture-row">
              <input
                id="task-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') addTask();
                }}
                placeholder="Example: Follow up with Allen about the estimate"
                maxLength={240}
              />
              <button onClick={addTask} disabled={!draft.trim()}>Add task</button>
            </div>
          </div>
        </section>

        <div className="grid">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">YOUR LIST</span>
                <h2>Current tasks</h2>
              </div>
              <span className="count-pill">{tasks.length}</span>
            </div>

            {tasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-mark">✓</div>
                <strong>Nothing waiting.</strong>
                <p>Add a task above when something needs your attention.</p>
              </div>
            ) : (
              <div className="task-list">
                {tasks.map((task) => (
                  <div key={task.id} className={`task-row ${task.status === 'done' ? 'done' : ''}`}>
                    <button className="check" onClick={() => toggleTask(task.id)} aria-label="Toggle task">
                      {task.status === 'done' ? '✓' : ''}
                    </button>
                    <button className="task-title" onClick={() => toggleTask(task.id)}>{task.title}</button>
                    <span className="task-date">{new Date(task.createdAt).toLocaleDateString()}</span>
                    <button className="remove" onClick={() => removeTask(task.id)} aria-label="Delete task">×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="agent-card">
            <div className="agent-mark">✦</div>
            <span className="eyebrow">AGENT MODE</span>
            <h2>Background work, done the right way.</h2>
            <p>
              The earlier build used browser timers, which stop when the browser closes. This beta does not label that as persistent automation.
            </p>
            <div className="agent-step ready"><span>✓</span><div><strong>Task capture</strong><small>Available now</small></div></div>
            <div className="agent-step ready"><span>✓</span><div><strong>Approval-first actions</strong><small>Safety model in place</small></div></div>
            <div className="agent-step building"><span>↻</span><div><strong>Server-side schedules</strong><small>Next agent layer</small></div></div>
            <div className="agent-step building"><span>↻</span><div><strong>Connected email & calendar actions</strong><small>Requires real connectors</small></div></div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .tasks-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .tasks-inner { width: min(1120px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        .page-header { display: flex; justify-content: space-between; gap: 28px; align-items: end; margin-bottom: 24px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0 8px; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        .page-header p { margin: 0; max-width: 680px; color: #888; line-height: 1.55; font-size: .82rem; }
        .stats { display: flex; gap: 8px; }
        .stats > div { min-width: 74px; padding: 10px 12px; border: 1px solid #343434; background: #272727; border-radius: 12px; }
        .stats strong, .stats span { display: block; }
        .stats strong { font-size: 1.05rem; }
        .stats span { color: #777; font-size: .65rem; margin-top: 2px; }
        .capture-card { display: grid; grid-template-columns: 38px 1fr; gap: 12px; padding: 16px; border: 1px solid #343434; background: #272727; border-radius: 16px; margin-bottom: 12px; }
        .capture-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: #efefef; color: #111; font-size: 1.2rem; }
        .capture-copy label { display: block; font-size: .78rem; font-weight: 650; margin-bottom: 9px; }
        .capture-row { display: flex; gap: 8px; }
        .capture-row input { min-width: 0; flex: 1; min-height: 42px; border-radius: 11px; border: 1px solid #3b3b3b; background: #1f1f1f; color: #ececec; padding: 0 12px; outline: none; }
        .capture-row input:focus { border-color: #5a5a5a; }
        .capture-row button { border: 0; border-radius: 11px; padding: 0 15px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .capture-row button:disabled { opacity: .35; cursor: default; }
        .grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, .65fr); gap: 12px; }
        .panel, .agent-card { border: 1px solid #343434; background: #262626; border-radius: 17px; }
        .panel { padding: 18px; min-height: 390px; }
        .panel-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .panel-heading h2, .agent-card h2 { margin: 5px 0 0; font-size: 1rem; }
        .count-pill { min-width: 28px; height: 24px; padding: 0 8px; border-radius: 999px; display: grid; place-items: center; background: #303030; color: #8b8b8b; font-size: .68rem; }
        .empty-state { min-height: 270px; display: grid; place-content: center; text-align: center; color: #868686; }
        .empty-mark { width: 42px; height: 42px; margin: 0 auto 10px; border-radius: 13px; display: grid; place-items: center; background: #303030; color: #71cd9b; }
        .empty-state strong { color: #bebebe; font-size: .82rem; }
        .empty-state p { margin: 5px 0 0; font-size: .72rem; }
        .task-list { display: grid; gap: 6px; }
        .task-row { display: grid; grid-template-columns: 29px minmax(0, 1fr) auto 26px; gap: 8px; align-items: center; min-height: 48px; padding: 7px 8px; border-radius: 11px; background: #2c2c2c; border: 1px solid transparent; }
        .task-row:hover { border-color: #3a3a3a; }
        .check { width: 27px; height: 27px; border-radius: 8px; border: 1px solid #484848; background: #232323; color: #6ed49d; cursor: pointer; }
        .task-title { border: 0; background: transparent; color: #d9d9d9; text-align: left; cursor: pointer; font-size: .78rem; }
        .task-date { color: #686868; font-size: .62rem; }
        .remove { border: 0; background: transparent; color: #626262; cursor: pointer; font-size: 1rem; }
        .task-row.done .task-title { text-decoration: line-through; color: #666; }
        .agent-card { padding: 20px; }
        .agent-mark { width: 40px; height: 40px; border-radius: 12px; background: #efefef; color: #111; display: grid; place-items: center; margin-bottom: 18px; }
        .agent-card > p { color: #858585; line-height: 1.55; font-size: .75rem; margin: 10px 0 18px; }
        .agent-step { display: grid; grid-template-columns: 28px 1fr; gap: 10px; padding: 11px 0; border-top: 1px solid #303030; }
        .agent-step > span { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: #303030; font-size: .7rem; }
        .agent-step.ready > span { color: #73d19f; }
        .agent-step.building > span { color: #e1bf73; }
        .agent-step strong, .agent-step small { display: block; }
        .agent-step strong { font-size: .74rem; }
        .agent-step small { color: #6d6d6d; font-size: .64rem; margin-top: 3px; }
        @media (max-width: 850px) { .grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) {
          .tasks-inner { width: calc(100% - 28px); padding-top: 24px; }
          .page-header { align-items: start; flex-direction: column; }
          .capture-row { flex-direction: column; }
          .capture-row button { min-height: 42px; }
          .task-row { grid-template-columns: 29px minmax(0, 1fr) 26px; }
          .task-date { display: none; }
        }
      `}</style>
    </div>
  );
};

export default TasksView;

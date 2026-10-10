'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

interface TasksViewProps {
  userId: string;
}

type TaskStatus = 'open' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

type LocalTask = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: number;
  dueDate?: string;
  priority?: TaskPriority;
  projectId?: string;
  projectName?: string;
  cloud?: boolean;
};

type ProjectOption = {
  id: string;
  name: string;
};

export const TasksView: React.FC<TasksViewProps> = ({ userId }) => {
  const storageKey = `lifes-assistant-tasks:${userId}`;
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [draft, setDraft] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [mode, setMode] = useState<'checking' | 'cloud' | 'local'>('checking');
  const [status, setStatus] = useState('');

  const saveLocal = (next: LocalTask[]) => {
    setTasks(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Local fallback is best-effort.
    }
  };

  useEffect(() => {
    let active = true;

    const hydrate = async () => {
      let handedOffTitle = '';

      try {
        const cloudHandoff = await firebaseBackend.getLatestDraft('handoff-task');
        if (
          cloudHandoff &&
          typeof cloudHandoff.title === 'string' &&
          cloudHandoff.title.trim()
        ) {
          handedOffTitle = cloudHandoff.title.trim();
          await firebaseBackend.saveDraft('handoff-task', {
            consumedAt: Date.now(),
          });
        }
      } catch {
        // Fall through to the device-local handoff if cloud sync is unavailable.
      }

      if (!handedOffTitle) {
        const rawDraft = localStorage.getItem('task_draft');

        if (rawDraft) {
          try {
            const parsed = JSON.parse(rawDraft);
            handedOffTitle =
              typeof parsed.title === 'string' ? parsed.title.trim() : '';
          } catch {
            handedOffTitle = '';
          }
          localStorage.removeItem('task_draft');
        }
      }

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

        const cloudTasks: LocalTask[] = records
          .filter((record) => record.kind === 'task')
          .map((record) => {
            const data = (record.data || {}) as Record<string, unknown>;
            return {
              id: String(record.id),
              title: String(data.title || ''),
              status: (data.status === 'done' ? 'done' : 'open') as TaskStatus,
              createdAt: Number(record.createdAt || Date.now()),
              dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
              priority: (data.priority === 'high' || data.priority === 'low' ? data.priority : 'normal') as TaskPriority,
              projectId: typeof data.projectId === 'string' ? data.projectId : '',
              projectName: typeof data.projectName === 'string' ? data.projectName : '',
              cloud: true,
            };
          })
          .filter((task) => task.title);

        let nextTasks = cloudTasks;

        if (handedOffTitle) {
          const id = await firebaseBackend.saveBusinessRecord('task', {
            title: handedOffTitle,
            status: 'open',
          });
          nextTasks = [
            { id, title: handedOffTitle, status: 'open', createdAt: Date.now(), priority: 'normal', dueDate: '', cloud: true },
            ...cloudTasks,
          ];
        }

        setTasks(nextTasks);
        setMode('cloud');
        setStatus('Cloud sync active.');
      } catch (error) {
        console.warn('Task cloud sync unavailable, using local fallback:', error);

        let existing: LocalTask[] = [];
        try {
          existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
        } catch {
          existing = [];
        }

        if (handedOffTitle) {
          existing = [
            {
              id: 'local-' + Date.now(),
              title: handedOffTitle,
              status: 'open',
              createdAt: Date.now(),
              priority: 'normal',
              dueDate: '',
              cloud: false,
            },
            ...existing,
          ];
        }

        if (!active) return;
        saveLocal(existing);
        setMode('local');
        setStatus('Cloud sync unavailable. Tasks are saved on this device.');
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, [storageKey]);

  const openCount = useMemo(() => tasks.filter((task) => task.status === 'open').length, [tasks]);
  const doneCount = tasks.length - openCount;
  const todayKey = new Date().toISOString().slice(0, 10);
  const overdueCount = useMemo(
    () => tasks.filter((task) => task.status === 'open' && task.dueDate && task.dueDate < todayKey).length,
    [tasks, todayKey]
  );
  const sortedTasks = useMemo(() => {
    const priorityRank: Record<TaskPriority, number> = { high: 0, normal: 1, low: 2 };

    return [...tasks].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;

      const aPriority = priorityRank[a.priority || 'normal'];
      const bPriority = priorityRank[b.priority || 'normal'];
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aDue = a.dueDate || '9999-12-31';
      const bDue = b.dueDate || '9999-12-31';
      if (aDue !== bDue) return aDue.localeCompare(bDue);

      return b.createdAt - a.createdAt;
    });
  }, [tasks]);

  const addTask = async () => {
    const title = draft.trim();
    if (!title) return;

    if (mode === 'cloud') {
      try {
        const selectedProject = projects.find((project) => project.id === projectId);
        const projectName = selectedProject?.name || '';

        const id = await firebaseBackend.saveBusinessRecord('task', {
          title,
          status: 'open',
          dueDate,
          priority,
          projectId,
          projectName,
        });
        await firebaseBackend.trackEvent('task.created', {
          title,
          recordId: id,
          dueDate,
          priority,
          projectId,
          projectName,
        });
        setTasks((current) => [
          { id, title, status: 'open', createdAt: Date.now(), dueDate, priority, projectId, projectName, cloud: true },
          ...current,
        ]);
        setDraft('');
        setDueDate('');
        setPriority('normal');
        setProjectId('');
        setStatus('Task saved to your cloud workspace.');
        return;
      } catch (error) {
        console.warn('Task cloud save failed:', error);
        setMode('local');
      }
    }

    const next = [
      {
        id: 'local-' + Date.now(),
        title,
        status: 'open' as TaskStatus,
        createdAt: Date.now(),
        dueDate,
        priority,
        projectId,
        projectName: projects.find((project) => project.id === projectId)?.name || '',
        cloud: false,
      },
      ...tasks,
    ];
    saveLocal(next);
    setDraft('');
    setDueDate('');
    setPriority('normal');
    setProjectId('');
    setStatus('Task saved on this device because cloud sync is unavailable.');
  };

  const toggleTask = async (task: LocalTask) => {
    const nextStatus: TaskStatus = task.status === 'open' ? 'done' : 'open';

    if (mode === 'cloud' && task.cloud) {
      try {
        await firebaseBackend.updateBusinessRecord(task.id, {
          title: task.title,
          status: nextStatus,
          dueDate: task.dueDate || '',
          priority: task.priority || 'normal',
          projectId: task.projectId || '',
          projectName: task.projectName || '',
        });
        if (nextStatus === 'done') {
          await firebaseBackend.trackEvent('task.completed', { title: task.title, recordId: task.id });
        }
        setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item));
        return;
      } catch (error) {
        console.warn('Task cloud update failed:', error);
        setStatus('Could not update the cloud task. Nothing was changed.');
        return;
      }
    }

    const next = tasks.map((item) => item.id === task.id ? { ...item, status: nextStatus } : item);
    saveLocal(next);
  };

  const removeTask = async (task: LocalTask) => {
    if (mode === 'cloud' && task.cloud) {
      try {
        await firebaseBackend.deleteBusinessRecord(task.id);
        setTasks((current) => current.filter((item) => item.id !== task.id));
        return;
      } catch (error) {
        console.warn('Task cloud delete failed:', error);
        setStatus('Could not delete the cloud task.');
        return;
      }
    }

    saveLocal(tasks.filter((item) => item.id !== task.id));
  };

  return (
    <div className="tasks-page">
      <div className="tasks-inner">
        <header className="page-header">
          <div>
            <span className="eyebrow">TASK CENTER</span>
            <h1>Keep the next move visible.</h1>
            <p>Tasks follow your signed-in workspace when Firestore is available, with an explicit local fallback when it is not.</p>
          </div>
          <div className="stats">
            <div><strong>{openCount}</strong><span>Open</span></div>
            <div><strong>{doneCount}</strong><span>Done</span></div>
            <div><strong>{overdueCount}</strong><span>Overdue</span></div>
          </div>
        </header>

        <div className={`sync-banner ${mode}`}>
          <span>{mode === 'cloud' ? '✓' : mode === 'local' ? '!' : '…'}</span>
          <strong>{mode === 'cloud' ? 'Cloud workspace' : mode === 'local' ? 'Local fallback' : 'Checking cloud storage'}</strong>
          <small>{status}</small>
        </div>

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
              <input
                className="date-input"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                aria-label="Due date"
              />
              <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} aria-label="Priority">
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
              <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Project">
                <option value="">No project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <button onClick={addTask} disabled={!draft.trim() || mode === 'checking'}>Add task</button>
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
                {sortedTasks.map((task) => (
                  <div key={task.id} className={`task-row ${task.status === 'done' ? 'done' : ''}`}>
                    <button className="check" onClick={() => toggleTask(task)} aria-label="Toggle task">
                      {task.status === 'done' ? '✓' : ''}
                    </button>
                    <button className="task-title" onClick={() => toggleTask(task)}>
                      <span>{task.title}</span>
                      <small>
                        {task.priority === 'high' ? 'High priority' : task.priority === 'low' ? 'Low priority' : 'Normal priority'}
                        {task.projectName ? ' · ' + task.projectName : ''}
                        {task.dueDate ? ' · Due ' + new Date(task.dueDate + 'T12:00:00').toLocaleDateString() : ''}
                      </small>
                    </button>
                    <span className={`task-date ${task.status === 'open' && task.dueDate && task.dueDate < todayKey ? 'overdue' : ''}`}>
                      {task.status === 'open' && task.dueDate && task.dueDate < todayKey ? 'Overdue' : task.dueDate || ''}
                    </span>
                    <button className="remove" onClick={() => removeTask(task)} aria-label="Delete task">×</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="agent-card">
            <div className="agent-mark">✦</div>
            <span className="eyebrow">AGENT MODE</span>
            <h2>From reminder to verified action.</h2>
            <p>
              Tasks are now persistent work objects. The next layer is server-side scheduling so due work can trigger while the browser is closed.
            </p>
            <div className="agent-step ready"><span>✓</span><div><strong>Persistent task records</strong><small>Cloud-first</small></div></div>
            <div className="agent-step ready"><span>✓</span><div><strong>Approval-first external actions</strong><small>Safety model</small></div></div>
            <div className="agent-step building"><span>↻</span><div><strong>Server-side schedules</strong><small>Connection layer next</small></div></div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .tasks-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .tasks-inner { width: min(1120px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        .page-header { display: flex; justify-content: space-between; gap: 28px; align-items: end; margin-bottom: 16px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0 8px; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        .page-header p { margin: 0; max-width: 680px; color: #888; line-height: 1.55; font-size: .82rem; }
        .stats { display: flex; gap: 8px; }
        .stats > div { min-width: 74px; padding: 10px 12px; border: 1px solid #343434; background: #272727; border-radius: 12px; }
        .stats strong, .stats span { display: block; }
        .stats strong { font-size: 1.05rem; }
        .stats span { color: #777; font-size: .65rem; margin-top: 2px; }
        .sync-banner { display: grid; grid-template-columns: 24px auto 1fr; gap: 8px; align-items: center; min-height: 42px; padding: 8px 12px; margin-bottom: 12px; border-radius: 11px; border: 1px solid #343434; background: #252525; }
        .sync-banner.cloud > span { color: #78d7a4; }
        .sync-banner.local > span { color: #e5c276; }
        .sync-banner strong { font-size: .72rem; }
        .sync-banner small { color: #6f6f6f; font-size: .64rem; }
        .capture-card { display: grid; grid-template-columns: 38px 1fr; gap: 12px; padding: 16px; border: 1px solid #343434; background: #272727; border-radius: 16px; margin-bottom: 12px; }
        .capture-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: #efefef; color: #111; font-size: 1.2rem; }
        .capture-copy label { display: block; font-size: .78rem; font-weight: 650; margin-bottom: 9px; }
        .capture-row { display: grid; grid-template-columns: minmax(0,1fr) 140px 105px 150px auto; gap: 8px; }
        .capture-row input, .capture-row select { min-width: 0; min-height: 42px; border-radius: 11px; border: 1px solid #3b3b3b; background: #1f1f1f; color: #ececec; padding: 0 12px; outline: none; }
        .capture-row input:first-child { width: 100%; }
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
        .check { width: 27px; height: 27px; border-radius: 8px; border: 1px solid #484848; background: #232323; color: #6ed49d; cursor: pointer; }
        .task-title { border: 0; background: transparent; color: #d9d9d9; text-align: left; cursor: pointer; font-size: .78rem; }
        .task-title span, .task-title small { display: block; }
        .task-title small { margin-top: 3px; color: #686868; font-size: .59rem; }
        .task-date { color: #686868; font-size: .62rem; }
        .task-date.overdue { color: #d88c8c; }
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
          .capture-row { grid-template-columns: 1fr; }
          .capture-row button { min-height: 42px; }
          .task-row { grid-template-columns: 29px minmax(0, 1fr) 26px; }
          .task-date { display: none; }
          .sync-banner { grid-template-columns: 24px 1fr; }
          .sync-banner small { grid-column: 2; }
        }
      `}</style>
    </div>
  );
};

export default TasksView;

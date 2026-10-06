'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type MemoryItem = {
  id: string;
  text: string;
  category: string;
  createdAt: number;
};

const CATEGORIES = ['General', 'People', 'Preferences', 'Work', 'Routine'];

export default function MemoryCenter() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const records = await firebaseBackend.getRecentBusinessRecords(100);
      const memories = records
        .filter((record) => record.kind === 'memory')
        .map((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          return {
            id: String(record.id || ''),
            text: String(data.text || ''),
            category: String(data.category || 'General'),
            createdAt: Number(record.createdAt || record.updatedAt || Date.now()),
          };
        })
        .filter((item) => item.text)
        .sort((a, b) => b.createdAt - a.createdAt);

      setItems(memories);
      setStatus(memories.length ? 'Memory synced to your account.' : 'No saved memories yet.');
    } catch {
      setItems([]);
      setStatus('Cloud memory could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const value = text.trim();
    if (!value) return;

    try {
      const id = await firebaseBackend.saveBusinessRecord('memory', {
        text: value,
        category,
      });

      await firebaseBackend.trackEvent('memory.saved', {
        category,
        preview: value.slice(0, 120),
        recordId: id,
      });

      setItems((current) => [
        { id, text: value, category, createdAt: Date.now() },
        ...current,
      ]);
      setText('');
      setStatus('Saved. New chats can use this memory.');
    } catch {
      setStatus('Memory could not be saved to the cloud workspace.');
    }
  };

  const remove = async (id: string) => {
    try {
      await firebaseBackend.deleteBusinessRecord(id);
      setItems((current) => current.filter((item) => item.id !== id));
      setStatus('Memory removed.');
    } catch {
      setStatus('Could not remove that memory.');
    }
  };

  return (
    <div className="memory-page">
      <div className="memory-inner">
        <header>
          <span className="eyebrow">MEMORY</span>
          <h1>Teach the assistant what should survive the chat.</h1>
          <p>
            Save durable context on purpose. Life&apos;s Assistant can use these memories in future conversations, and you stay in control of the list.
          </p>
        </header>

        <section className="capture">
          <div className="capture-copy">
            <strong>Always remember…</strong>
            <small>Save a person, preference, work rule, routine, or important fact.</small>
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Example: Allen prefers short estimates with labor and materials broken out separately."
            maxLength={700}
          />
          <div className="capture-actions">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button onClick={save} disabled={!text.trim()}>Remember this</button>
          </div>
        </section>

        <section className="memory-list">
          <div className="list-heading">
            <div>
              <span className="eyebrow">SAVED CONTEXT</span>
              <h2>{loading ? 'Loading…' : items.length + ' memories'}</h2>
            </div>
            <span>{status}</span>
          </div>

          {items.length === 0 && !loading ? (
            <div className="empty">
              <div>◎</div>
              <strong>No persistent memories yet.</strong>
              <p>Add one above and it can follow you into future conversations.</p>
            </div>
          ) : (
            <div className="cards">
              {items.map((item) => (
                <article key={item.id}>
                  <div className="category">{item.category}</div>
                  <p>{item.text}</p>
                  <div className="meta">
                    <time>{new Date(item.createdAt).toLocaleString()}</time>
                    <button onClick={() => remove(item.id)}>Forget</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .memory-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .memory-inner { width: min(980px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { margin-bottom: 20px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 740px; color: #858585; font-size: .8rem; line-height: 1.55; }
        .capture, .memory-list { background: #262626; border: 1px solid #343434; border-radius: 17px; padding: 18px; }
        .capture { display: grid; gap: 12px; }
        .capture-copy strong, .capture-copy small { display: block; }
        .capture-copy strong { font-size: .82rem; }
        .capture-copy small { margin-top: 3px; color: #707070; font-size: .66rem; }
        textarea { min-height: 105px; resize: vertical; width: 100%; padding: 12px; border: 1px solid #414141; border-radius: 11px; background: #1f1f1f; color: #efefef; outline: none; line-height: 1.5; }
        textarea:focus { border-color: #606060; }
        .capture-actions { display: flex; justify-content: flex-end; gap: 8px; }
        select, .capture-actions button { min-height: 40px; border-radius: 10px; padding: 0 12px; }
        select { border: 1px solid #414141; background: #242424; color: #ddd; }
        .capture-actions button { border: 0; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .capture-actions button:disabled { opacity: .35; cursor: default; }
        .memory-list { margin-top: 12px; }
        .list-heading { display: flex; justify-content: space-between; gap: 14px; align-items: end; margin-bottom: 12px; }
        .list-heading h2 { margin: 5px 0 0; font-size: 1rem; }
        .list-heading > span { color: #6f6f6f; font-size: .64rem; }
        .cards { display: grid; gap: 8px; }
        article { padding: 14px; border: 1px solid #343434; border-radius: 13px; background: #2b2b2b; }
        .category { display: inline-flex; padding: 3px 7px; border-radius: 999px; background: #343434; color: #909090; font-size: .56rem; letter-spacing: .08em; text-transform: uppercase; }
        article p { margin: 9px 0 12px; color: #d0d0d0; font-size: .76rem; line-height: 1.5; white-space: pre-wrap; }
        .meta { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        time { color: #606060; font-size: .6rem; }
        .meta button { min-height: 28px; border: 0; background: transparent; color: #9a7777; cursor: pointer; font-size: .65rem; }
        .empty { min-height: 180px; display: grid; place-content: center; text-align: center; color: #707070; }
        .empty > div { width: 40px; height: 40px; margin: 0 auto 9px; border-radius: 12px; display: grid; place-items: center; background: #303030; }
        .empty strong { color: #bcbcbc; font-size: .76rem; }
        .empty p { margin: 4px 0 0; font-size: .65rem; }
        @media (max-width: 620px) {
          .memory-inner { width: calc(100% - 28px); padding-top: 24px; }
          .capture-actions { flex-direction: column; }
          .list-heading { align-items: start; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

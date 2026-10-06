'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type SearchItem = {
  id: string;
  kind: string;
  title: string;
  text: string;
  createdAt: number;
  destination: string;
};

interface WorkspaceSearchProps {
  onNavigate: (view: string) => void;
}

const destinationForKind = (kind: string) => {
  if (kind === 'task') return 'tasks';
  if (kind === 'note') return 'notes';
  if (kind === 'quote') return 'quotes';
  if (kind === 'material-estimate') return 'materials';
  if (kind === 'memory') return 'memory';
  if (kind === 'person') return 'people';
  if (kind === 'brief') return 'brief';
  return 'receipts';
};

const titleFromData = (kind: string, data: Record<string, unknown>) => {
  return String(
    data.title ||
    data.clientName ||
    data.projectName ||
    data.subject ||
    data.text ||
    data.projectDescription ||
    data.preview ||
    kind
  ).slice(0, 120);
};

export default function WorkspaceSearch({ onNavigate }: WorkspaceSearchProps) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [status, setStatus] = useState('Loading your workspace…');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [records, events, conversations] = await Promise.all([
          firebaseBackend.getRecentBusinessRecords(200),
          firebaseBackend.getRecentEvents(100),
          firebaseBackend.getConversations(),
        ]);

        if (!active) return;

        const recordItems: SearchItem[] = records.map((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          const kind = String(record.kind || 'workspace');
          return {
            id: 'record-' + String(record.id || record.createdAt),
            kind,
            title: titleFromData(kind, data),
            text: JSON.stringify(data),
            createdAt: Number(record.updatedAt || record.createdAt || Date.now()),
            destination: destinationForKind(kind),
          };
        });

        const eventItems: SearchItem[] = events.map((event) => {
          const data = (event.data || {}) as Record<string, unknown>;
          return {
            id: 'event-' + String(event.id || event.createdAt),
            kind: 'receipt',
            title: String(event.eventName || 'Workspace receipt'),
            text: JSON.stringify(data),
            createdAt: Number(event.createdAt || Date.now()),
            destination: 'receipts',
          };
        });

        const conversationItems: SearchItem[] = conversations.map((conversation) => ({
          id: 'conversation-' + conversation.id,
          kind: 'conversation',
          title: conversation.title || 'Conversation',
          text: conversation.businessContext || '',
          createdAt: Number(conversation.updatedAt || conversation.createdAt || Date.now()),
          destination: 'chat',
        }));

        const all = recordItems
          .concat(eventItems, conversationItems)
          .sort((a, b) => b.createdAt - a.createdAt);

        setItems(all);
        setStatus(all.length ? all.length + ' searchable workspace items.' : 'Nothing has been saved yet.');
      } catch {
        setItems([]);
        setStatus('Workspace search could not load cloud data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 24);

    const terms = needle.split(/s+/).filter(Boolean);

    return items
      .map((item) => {
        const haystack = (item.kind + ' ' + item.title + ' ' + item.text).toLowerCase();
        const score = terms.reduce((sum, term) => {
          if (item.title.toLowerCase().includes(term)) return sum + 4;
          if (item.kind.toLowerCase().includes(term)) return sum + 2;
          if (haystack.includes(term)) return sum + 1;
          return sum;
        }, 0);

        return { item, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.item.createdAt - a.item.createdAt)
      .slice(0, 50)
      .map((entry) => entry.item);
  }, [items, query]);

  return (
    <div className="search-page">
      <div className="search-inner">
        <header>
          <span className="eyebrow">WORKSPACE SEARCH</span>
          <h1>Find anything you trusted Life&apos;s Assistant to keep.</h1>
          <p>Search across tasks, notes, quotes, estimates, memories, briefs, receipts, and conversation titles from one place.</p>
        </header>

        <div className="search-box">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a person, project, task, amount, idea, or phrase…"
            autoFocus
          />
          {query && <button onClick={() => setQuery('')}>Clear</button>}
        </div>

        <div className="result-heading">
          <strong>{loading ? 'Loading…' : query.trim() ? results.length + ' matches' : 'Recent workspace'}</strong>
          <span>{status}</span>
        </div>

        <section className="results">
          {!loading && results.length === 0 ? (
            <div className="empty">
              <div>⌕</div>
              <strong>No match found.</strong>
              <p>Try a person&apos;s name, a project word, a task, or a phrase you remember using.</p>
            </div>
          ) : (
            results.map((item) => (
              <button key={item.id} className="result" onClick={() => onNavigate(item.destination)}>
                <span className="kind">{item.kind.replace('-', ' ').toUpperCase()}</span>
                <span className="result-copy">
                  <strong>{item.title}</strong>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </span>
                <span className="open">→</span>
              </button>
            ))
          )}
        </section>
      </div>

      <style jsx>{`
        .search-page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .search-inner { width: min(980px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        header { margin-bottom: 20px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 760px; color: #858585; font-size: .8rem; line-height: 1.55; }
        .search-box {
          display: grid;
          grid-template-columns: 30px minmax(0,1fr) auto;
          gap: 8px;
          align-items: center;
          padding: 7px 9px;
          border: 1px solid #3d3d3d;
          border-radius: 14px;
          background: #262626;
          box-shadow: 0 14px 38px rgba(0,0,0,.15);
        }
        .search-box > span { color: #777; text-align: center; }
        .search-box input {
          min-height: 45px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #ededed;
          font-size: .86rem;
        }
        .search-box input::placeholder { color: #626262; }
        .search-box button {
          min-height: 34px;
          padding: 0 10px;
          border: 1px solid #404040;
          border-radius: 9px;
          background: #303030;
          color: #999;
          cursor: pointer;
        }
        .result-heading {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: end;
          margin: 22px 2px 9px;
        }
        .result-heading strong { font-size: .76rem; }
        .result-heading span { color: #666; font-size: .63rem; }
        .results { display: grid; gap: 7px; }
        .result {
          min-height: 68px;
          display: grid;
          grid-template-columns: 105px minmax(0,1fr) 28px;
          gap: 12px;
          align-items: center;
          padding: 10px 13px;
          border: 1px solid #343434;
          border-radius: 12px;
          background: #272727;
          color: #ddd;
          text-align: left;
          cursor: pointer;
        }
        .result:hover { background: #2d2d2d; border-color: #414141; }
        .kind {
          color: #6f6f6f;
          font-size: .56rem;
          letter-spacing: .1em;
          font-weight: 750;
        }
        .result-copy { min-width: 0; }
        .result-copy strong, .result-copy small { display: block; }
        .result-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .76rem; }
        .result-copy small { margin-top: 4px; color: #626262; font-size: .59rem; }
        .open { color: #686868; text-align: center; }
        .empty {
          min-height: 260px;
          display: grid;
          place-content: center;
          text-align: center;
          border: 1px solid #343434;
          border-radius: 16px;
          background: #262626;
          color: #707070;
        }
        .empty > div { width: 42px; height: 42px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 12px; background: #303030; }
        .empty strong { color: #bcbcbc; font-size: .78rem; }
        .empty p { max-width: 420px; margin: 5px auto 0; font-size: .65rem; line-height: 1.45; }
        @media (max-width: 650px) {
          .search-inner { width: calc(100% - 28px); padding-top: 24px; }
          .result { grid-template-columns: 1fr 26px; }
          .kind { grid-column: 1 / -1; }
          .result-heading { align-items: start; flex-direction: column; }
        }
      `}</style>
    </div>
  );
}

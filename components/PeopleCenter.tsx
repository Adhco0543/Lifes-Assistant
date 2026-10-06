'use client';

import React, { useEffect, useState } from 'react';
import { firebaseBackend } from '../lib/firebaseBackend';

type Person = {
  id: string;
  name: string;
  relationship: string;
  notes: string;
  createdAt: number;
};

export default function PeopleCenter() {
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Loading people…');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const records = await firebaseBackend.getRecentBusinessRecords(150);
      const next = records
        .filter((record) => record.kind === 'person')
        .map((record) => {
          const data = (record.data || {}) as Record<string, unknown>;
          return {
            id: String(record.id || ''),
            name: String(data.name || ''),
            relationship: String(data.relationship || ''),
            notes: String(data.notes || ''),
            createdAt: Number(record.createdAt || Date.now()),
          };
        })
        .filter((person) => person.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setPeople(next);
      setStatus(next.length ? next.length + ' people saved.' : 'No people saved yet.');
    } catch {
      setPeople([]);
      setStatus('People could not be loaded from the cloud workspace.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      const id = await firebaseBackend.saveBusinessRecord('person', {
        name: name.trim(),
        relationship: relationship.trim(),
        notes: notes.trim(),
      });

      await firebaseBackend.trackEvent('person.saved', {
        recordId: id,
        name: name.trim(),
        relationship: relationship.trim(),
      });

      setPeople((current) =>
        current.concat({
          id,
          name: name.trim(),
          relationship: relationship.trim(),
          notes: notes.trim(),
          createdAt: Date.now(),
        }).sort((a, b) => a.name.localeCompare(b.name))
      );

      setName('');
      setRelationship('');
      setNotes('');
      setStatus('Person saved. Future chats can use this context.');
    } catch {
      setStatus('That person could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (person: Person) => {
    try {
      await firebaseBackend.deleteBusinessRecord(person.id);
      setPeople((current) => current.filter((item) => item.id !== person.id));
      setStatus(person.name + ' was removed.');
    } catch {
      setStatus('Could not remove that person.');
    }
  };

  return (
    <div className="page">
      <div className="inner">
        <header>
          <span className="eyebrow">PEOPLE</span>
          <h1>Remember the person, not just the conversation.</h1>
          <p>
            Save the context that matters about family, coworkers, clients, friends, or anyone you deal with often. Life&apos;s Assistant can use it in future chats.
          </p>
        </header>

        <section className="capture">
          <div className="capture-grid">
            <label>
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" maxLength={80} />
            </label>
            <label>
              <span>Relationship</span>
              <input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Boss, partner, client, friend…" maxLength={100} />
            </label>
          </div>
          <label>
            <span>Useful context</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Preferences, communication style, recurring details, things worth remembering…"
              maxLength={1200}
            />
          </label>
          <div className="capture-footer">
            <small>{status}</small>
            <button onClick={save} disabled={!name.trim() || saving}>{saving ? 'Saving…' : 'Save person'}</button>
          </div>
        </section>

        <section className="people-section">
          <div className="section-head">
            <div>
              <span className="eyebrow">YOUR PEOPLE</span>
              <h2>{people.length} saved</h2>
            </div>
          </div>

          {people.length === 0 ? (
            <div className="empty">
              <div>◎</div>
              <strong>No people saved yet.</strong>
              <p>Add someone above and Life&apos;s Assistant can carry that context into future conversations.</p>
            </div>
          ) : (
            <div className="cards">
              {people.map((person) => (
                <article key={person.id}>
                  <div className="avatar">{person.name.charAt(0).toUpperCase()}</div>
                  <div className="person-copy">
                    <strong>{person.name}</strong>
                    <span>{person.relationship || 'Person'}</span>
                    {person.notes && <p>{person.notes}</p>}
                  </div>
                  <button onClick={() => remove(person)}>Remove</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .page { height: 100%; overflow-y: auto; background: #212121; color: #ececec; }
        .inner { width: min(980px, calc(100% - 44px)); margin: 0 auto; padding: 42px 0 70px; }
        .eyebrow { color: #747474; font-size: .64rem; letter-spacing: .14em; font-weight: 750; }
        h1 { margin: 8px 0; font-size: clamp(1.8rem, 4vw, 3rem); letter-spacing: -.045em; font-weight: 650; }
        header p { margin: 0; max-width: 760px; color: #858585; font-size: .8rem; line-height: 1.55; }
        .capture { margin-top: 22px; padding: 18px; border: 1px solid #343434; border-radius: 17px; background: #262626; display: grid; gap: 12px; }
        .capture-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        label { display: grid; gap: 7px; }
        label > span { color: #bdbdbd; font-size: .7rem; font-weight: 650; }
        input, textarea { width: 100%; border: 1px solid #414141; border-radius: 10px; background: #1f1f1f; color: #ededed; outline: 0; padding: 11px 12px; }
        textarea { min-height: 100px; resize: vertical; line-height: 1.45; }
        input:focus, textarea:focus { border-color: #626262; }
        .capture-footer { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .capture-footer small { color: #6d6d6d; font-size: .63rem; }
        .capture-footer button { min-height: 40px; padding: 0 13px; border: 0; border-radius: 10px; background: #ededed; color: #111; font-weight: 650; cursor: pointer; }
        .capture-footer button:disabled { opacity: .35; cursor: default; }
        .people-section { margin-top: 12px; padding: 18px; border: 1px solid #343434; border-radius: 17px; background: #262626; }
        .section-head h2 { margin: 5px 0 12px; font-size: 1rem; }
        .cards { display: grid; gap: 8px; }
        article { min-height: 78px; display: grid; grid-template-columns: 42px minmax(0,1fr) auto; gap: 12px; align-items: start; padding: 12px; border: 1px solid #343434; border-radius: 13px; background: #2b2b2b; }
        .avatar { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: #343434; color: #ddd; font-weight: 700; }
        .person-copy strong, .person-copy span { display: block; }
        .person-copy strong { font-size: .78rem; }
        .person-copy span { margin-top: 2px; color: #777; font-size: .62rem; }
        .person-copy p { margin: 8px 0 0; color: #aaa; font-size: .68rem; line-height: 1.45; white-space: pre-wrap; }
        article button { min-height: 30px; border: 0; background: transparent; color: #9a7474; cursor: pointer; font-size: .62rem; }
        .empty { min-height: 190px; display: grid; place-content: center; text-align: center; color: #707070; }
        .empty > div { width: 42px; height: 42px; display: grid; place-items: center; margin: 0 auto 10px; border-radius: 12px; background: #303030; }
        .empty strong { color: #bcbcbc; font-size: .78rem; }
        .empty p { max-width: 420px; margin: 5px auto 0; font-size: .65rem; line-height: 1.45; }
        @media (max-width: 650px) {
          .inner { width: calc(100% - 28px); padding-top: 24px; }
          .capture-grid { grid-template-columns: 1fr; }
          .capture-footer { align-items: stretch; flex-direction: column; }
          .capture-footer button { width: 100%; }
          article { grid-template-columns: 42px minmax(0,1fr); }
          article button { grid-column: 2; justify-self: start; }
        }
      `}</style>
    </div>
  );
}

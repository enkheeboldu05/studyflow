import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { TaskEntry } from '../types';

export function TaskEntries({ taskId }: { taskId: number }) {
  const [entries, setEntries] = useState<TaskEntry[]>([]);
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get<{ entries: TaskEntry[] }>(`/tasks/${taskId}/entries`)
      .then(({ entries: loaded }) => { if (active) setEntries(loaded); })
      .catch((error: Error) => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      const path = `/tasks/${taskId}/entries`;
      const { entry } = editingId === null
        ? await api.post<{ entry: TaskEntry }>(path, { content })
        : await api.patch<{ entry: TaskEntry }>(`${path}/${editingId}`, { content });
      setEntries((current) => editingId === null ? [entry, ...current] : current.map((item) => item.id === entry.id ? entry : item));
      setContent('');
      setEditingId(null);
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }

  async function remove(entry: TaskEntry) {
    if (!window.confirm('Delete this note?')) return;
    setSaving(true);
    setError('');
    try {
      await api.delete(`/tasks/${taskId}/entries/${entry.id}`);
      setEntries((current) => current.filter((item) => item.id !== entry.id));
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <section className="task-entries" aria-label="Task notes">
      <h3>Notes</h3>
      {loading ? <p>Loading notes…</p> : entries.length === 0 && <p>No notes yet. Leave a thought for your next session.</p>}
      {entries.map((entry) => (
        <article key={entry.id}>
          <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
          {entry.updatedAt !== entry.createdAt && <small> · edited</small>}
          <p>{entry.content}</p>
          <div className="entry-actions">
            <button className="secondary-button" disabled={saving || editingId !== null} onClick={() => { setEditingId(entry.id); setContent(entry.content); }}>Edit</button>
            <button className="secondary-button" disabled={saving || editingId !== null} onClick={() => remove(entry)}>Delete</button>
          </div>
        </article>
      ))}
      <form onSubmit={(event) => { event.preventDefault(); if (content.trim()) void save(); }}>
        <label htmlFor="task-entry-content">{editingId === null ? 'Add a note' : 'Edit note'}</label>
        <textarea id="task-entry-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={3} placeholder="Where did you leave off?" disabled={saving} required />
        <div className="entry-actions">
          <button className="secondary-button" disabled={loading || saving || !content.trim()}>{saving ? 'Saving…' : editingId === null ? 'Add entry' : 'Save note'}</button>
          {editingId !== null && <button type="button" className="secondary-button" disabled={saving} onClick={() => { setEditingId(null); setContent(''); }}>Cancel</button>}
        </div>
      </form>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

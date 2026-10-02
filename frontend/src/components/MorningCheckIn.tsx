import { useState } from 'react';
import { ArrowRight, CalendarDays, Inbox } from 'lucide-react';
import { api } from '../lib/api';
import { addDays, dateKey, displayDate, todayKey } from '../lib/dates';
import type { StudyTask } from '../types';

interface MorningCheckInProps {
  tasks: StudyTask[];
  username: string;
  onFinished: () => void;
}

export function MorningCheckIn({ tasks: initial, username, onFinished }: MorningCheckInProps) {
  const [tasks, setTasks] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  async function move(task: StudyTask, scheduledDate: string | null) {
    setSaving(true);
    setError('');
    try {
      const carryNote = notes[task.id]?.trim();
      await api.patch(`/tasks/${task.id}`, { scheduledDate, ...(carryNote ? { carryNote } : {}) });
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  async function finish() {
    setSaving(true);
    setError('');
    try {
      await api.post('/check-in/complete');
      onFinished();
    } catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  return (
    <div className="modal-backdrop checkin-backdrop">
      <section className="modal-card checkin-card" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
        <p className="kicker">Morning check-in</p>
        <h2 id="checkin-title">Good morning, {username}.</h2>
        <p>{tasks.length ? 'A few things are waiting from earlier days. Decide where they belong before making today’s plan.' : 'Nothing needs carrying forward. Your day starts with a clear page.'}</p>
        <div className="carry-list">
          {tasks.map((task) => (
            <div className="carry-item" key={task.id}>
              <div><strong>{task.title}</strong><span>{task.subject?.name ?? 'Uncategorized'} · planned {displayDate(task.scheduledDate)}</span>
                <details>
                  <summary>Add note (optional)</summary>
                  <textarea aria-label={`Note for ${task.title}`} placeholder="Where did you leave off?" rows={2} maxLength={2000} value={notes[task.id] ?? ''} disabled={saving} onChange={(event) => setNotes((current) => ({ ...current, [task.id]: event.target.value }))} />
                </details>
              </div>
              <div className="carry-actions">
                <button disabled={saving} onClick={() => move(task, todayKey())}>Today</button>
                <button disabled={saving} onClick={() => move(task, dateKey(addDays(new Date(), 1)))}>Tomorrow</button>
                <button disabled={saving} onClick={() => move(task, null)}><Inbox size={13} /> Backlog</button>
              </div>
            </div>
          ))}
        </div>
        <button className="primary-button checkin-finish" onClick={finish} disabled={saving || tasks.length > 0}>{saving ? 'Opening your day…' : 'Open today'} <ArrowRight size={16} /></button>
        {tasks.length > 0 && <p className="decision-note"><CalendarDays size={14} /> Give each unfinished task a new home first.</p>}
        {error && <p role="alert">{error}</p>}
      </section>
    </div>
  );
}

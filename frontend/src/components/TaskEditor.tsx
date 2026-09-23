import { useEffect, useState, type FormEvent } from 'react';
import { BookOpen, X } from 'lucide-react';
import { api } from '../lib/api';
import { todayKey } from '../lib/dates';
import type { StudyTask, Subject, TaskInput, VaultNote } from '../types';

interface TaskEditorProps {
  task?: StudyTask | null;
  defaultDate?: string | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}

export function TaskEditor({ task, defaultDate, subjects, onClose, onSaved }: TaskEditorProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [availableNotes, setAvailableNotes] = useState<VaultNote[]>([]);
  const [linkedIds, setLinkedIds] = useState<number[]>([]);
  const [noteSearch, setNoteSearch] = useState('');

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [onClose]);

  useEffect(() => {
    api.get<{ notes: VaultNote[] }>('/notes?sort=title').then(({ notes }) => setAvailableNotes(notes)).catch(() => undefined);
    if (task) {
      api.get<{ notes: VaultNote[] }>('/tasks/' + task.id + '/notes')
        .then(({ notes }) => setLinkedIds(notes.map((note) => note.id)))
        .catch(() => undefined);
    }
  }, [task]);

  function toggleNote(noteId: number) {
    setLinkedIds((current) => current.includes(noteId) ? current.filter((id) => id !== noteId) : [...current, noteId]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimated = form.get('estimatedMinutes');
    const data: TaskInput = {
      title: String(form.get('title') ?? ''),
      description: String(form.get('description') ?? ''),
      subjectId: form.get('subjectId') ? Number(form.get('subjectId')) : null,
      status: form.get('status') as TaskInput['status'],
      priority: form.get('priority') as TaskInput['priority'],
      scheduledDate: String(form.get('scheduledDate') ?? '') || null,
      dueDate: String(form.get('dueDate') ?? '') || null,
      estimatedMinutes: estimated ? Number(estimated) : null,
      important: form.get('important') === 'on',
      recurrence: form.get('recurrence') as TaskInput['recurrence'],
    };
    setSaving(true); setError('');
    try {
      const saved = task
        ? await api.patch<{ task: StudyTask }>(`/tasks/${task.id}`, data)
        : await api.post<{ task: StudyTask }>('/tasks', data);
      const taskId = saved.task.id;
      const previouslyLinked = task
        ? (await api.get<{ notes: VaultNote[] }>('/tasks/' + taskId + '/notes')).notes.map((note) => note.id)
        : [];
      await Promise.all([
        ...linkedIds.filter((id) => !previouslyLinked.includes(id)).map((noteId) => api.post('/tasks/' + taskId + '/notes', { noteId })),
        ...previouslyLinked.filter((id) => !linkedIds.includes(id)).map((noteId) => api.delete('/tasks/' + taskId + '/notes/' + noteId)),
      ]);
      onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save task.');
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!task || !window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    try { await api.delete(`/tasks/${task.id}`); onSaved(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete task.'); }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card task-editor" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header><div><p className="kicker">{task ? 'Task details' : defaultDate ? 'Plan the day' : 'Capture a thought'}</p><h2 id="task-editor-title">{task ? 'Edit task' : 'New task'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X /></button></header>
        <form onSubmit={save}>
          <label className="wide">Task title<input name="title" defaultValue={task?.title} required autoFocus maxLength={180} placeholder="e.g. Solve 15 SQL JOIN questions" /></label>
          <label className="wide">Notes<textarea name="description" defaultValue={task?.description ?? ''} rows={3} placeholder="Optional context or next action" /></label>
          <label>Subject<select name="subjectId" defaultValue={task?.subjectId ?? ''}><option value="">Uncategorized</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <label>Status<select name="status" defaultValue={task?.status ?? 'TODO'}><option value="TODO">Planned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></label>
          <label>Priority<select name="priority" defaultValue={task?.priority ?? 'MEDIUM'}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
          <label>Planned day<input type="date" name="scheduledDate" defaultValue={task?.scheduledDate?.slice(0, 10) ?? defaultDate ?? ''} min="2020-01-01" /></label>
          <label>Real deadline<input type="date" name="dueDate" defaultValue={task?.dueDate?.slice(0, 10) ?? ''} min={todayKey()} /></label>
          <label>Estimated time<select name="estimatedMinutes" defaultValue={task?.estimatedMinutes ?? ''}><option value="">No estimate</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option><option value="180">3 hours</option></select></label>
          <label>Repeat<select name="recurrence" defaultValue={task?.recurrence ?? 'NONE'}><option value="NONE">Does not repeat</option><option value="DAILY">Every day</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month</option></select></label>
          <label className="checkbox-label wide"><input type="checkbox" name="important" defaultChecked={task?.important} /> Mark as important</label>
          {availableNotes.length > 0 && <fieldset className="task-note-picker wide">
            <legend><BookOpen size={15} /> Linked Obsidian notes</legend>
            <input value={noteSearch} onChange={(event) => setNoteSearch(event.target.value)} placeholder="Search indexed notes" />
            <div>{availableNotes.filter((note) => linkedIds.includes(note.id) || (note.title + ' ' + note.folder).toLocaleLowerCase().includes(noteSearch.toLocaleLowerCase())).slice(0, 50).map((note) => <label key={note.id} className="checkbox-label"><input type="checkbox" checked={linkedIds.includes(note.id)} onChange={() => toggleNote(note.id)} /><span><strong>{note.title}</strong><small>{note.folder || 'Vault root'}</small></span></label>)}</div>
          </fieldset>}
          {error && <div className="form-error wide" role="alert">{error}</div>}
          <footer className="wide">{task ? <button type="button" className="danger-text" onClick={remove}>Delete task</button> : <span />}<div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save task'}</button></div></footer>
        </form>
      </section>
    </div>
  );
}

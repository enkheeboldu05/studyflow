import { BookOpen, ChevronDown, Plus, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api } from '../lib/api';
import { todayKey } from '../lib/dates';
import type { LinkedVaultNote, StudyTask, Subject, TaskInput, VaultNote, VaultStatus } from '../types';

interface TaskEditorDialogProps {
  task?: StudyTask | null;
  defaultDate?: string | null;
  subjects: Subject[];
  onClose: () => void;
  onSaved: (task: StudyTask, created: boolean) => void;
}

export function TaskEditorDialog({ task, defaultDate, subjects, onClose, onSaved }: TaskEditorDialogProps) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState<LinkedVaultNote[]>([]);
  const [noteSearch, setNoteSearch] = useState('');
  const [noteResults, setNoteResults] = useState<VaultNote[]>([]);
  const [searchingNotes, setSearchingNotes] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm('Discard your unsaved changes?')) return;
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener('keydown', close);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [dirty, requestClose]);

  useEffect(() => {
    api.get<VaultStatus>('/vault/status').then(setVaultStatus).catch(() => setVaultStatus(null));
    if (!task) return;
    api.get<{ notes: LinkedVaultNote[] }>('/tasks/' + task.id + '/notes')
      .then(({ notes }) => setSelectedNotes(notes))
      .catch(() => undefined);
  }, [task]);

  useEffect(() => {
    const query = noteSearch.trim();
    if (query.length < 2 || !vaultStatus?.available) {
      setNoteResults([]);
      setSearchingNotes(false);
      return;
    }
    setSearchingNotes(true);
    const timer = window.setTimeout(() => {
      api.get<{ notes: VaultNote[] }>('/notes?sort=title&search=' + encodeURIComponent(query))
        .then(({ notes }) => setNoteResults(notes.slice(0, 20)))
        .catch(() => setNoteResults([]))
        .finally(() => setSearchingNotes(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [noteSearch, vaultStatus?.available]);

  function addNote(note: VaultNote) {
    if (!selectedNotes.some((item) => item.id === note.id)) setSelectedNotes((current) => [...current, note]);
    setDirty(true);
  }

  function removeNote(noteId: number) {
    setSelectedNotes((current) => current.filter((note) => note.id !== noteId));
    setDirty(true);
  }

  function searchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'ArrowDown') return;
    const first = resultRef.current?.querySelector<HTMLButtonElement>('button');
    if (first) {
      event.preventDefault();
      first.focus();
    }
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
    setSaving(true);
    setError('');
    try {
      const saved = task
        ? await api.patch<{ task: StudyTask }>('/tasks/' + task.id, data)
        : await api.post<{ task: StudyTask }>('/tasks', data);
      const taskId = saved.task.id;
      const previous = task
        ? (await api.get<{ notes: VaultNote[] }>('/tasks/' + taskId + '/notes')).notes.map((note) => note.id)
        : [];
      const selectedIds = selectedNotes.map((note) => note.id);
      await Promise.all([
        ...selectedIds.filter((id) => !previous.includes(id)).map((noteId) => api.post('/tasks/' + taskId + '/notes', { noteId })),
        ...previous.filter((id) => !selectedIds.includes(id)).map((noteId) => api.delete('/tasks/' + taskId + '/notes/' + noteId)),
      ]);
      setDirty(false);
      onSaved(saved.task, !task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save task.');
    } finally {
      setSaving(false);
    }
  }

  const vaultUnavailable = vaultStatus?.configured && !vaultStatus.available;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && requestClose()}>
      <section className="modal-card task-editor task-editor-redesign" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <header>
          <div><p className="kicker">{task ? 'Refine the plan' : defaultDate ? 'Plan the day' : 'Capture a thought'}</p><h2 id="task-editor-title">{task ? 'Edit task' : 'New task'}</h2></div>
          <button className="icon-button" onClick={requestClose} aria-label="Close editor"><X /></button>
        </header>

        <form ref={formRef} onSubmit={save} onChange={() => setDirty(true)}>
          <div className="task-editor-scroll">
            <section className="editor-section">
              <div className="editor-section-heading"><span>01</span><div><h3>Primary</h3><p>The essential task information.</p></div></div>
              <div className="editor-fields">
                <label className="wide">Task title<input name="title" defaultValue={task?.title} required autoFocus maxLength={180} placeholder="e.g. Solve 15 SQL JOIN questions" /></label>
                <label className="wide">Description <small>Optional</small><textarea name="description" defaultValue={task?.description ?? ''} rows={3} placeholder="Context, requirements, or the next action" /></label>
                <label>Subject<select name="subjectId" defaultValue={task?.subjectId ?? ''}><option value="">Uncategorized</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <label>Status<select name="status" defaultValue={task?.status ?? 'TODO'}><option value="TODO">Planned</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></label>
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-heading"><span>02</span><div><h3>Scheduling</h3><p>Planned work and the actual deadline stay separate.</p></div></div>
              <div className="editor-fields">
                <label>Planned day<input type="date" name="scheduledDate" defaultValue={task?.scheduledDate?.slice(0, 10) ?? defaultDate ?? ''} min="2020-01-01" /></label>
                <label>Real deadline<input type="date" name="dueDate" defaultValue={task?.dueDate?.slice(0, 10) ?? ''} min={todayKey()} /></label>
              </div>
            </section>

            <details className="editor-additional">
              <summary><span><ChevronDown size={16} /> Additional options</span><small>Priority, estimate, repeat, important</small></summary>
              <div className="editor-fields">
                <label>Priority<select name="priority" defaultValue={task?.priority ?? 'MEDIUM'}><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label>
                <label>Estimated time<select name="estimatedMinutes" defaultValue={task?.estimatedMinutes ?? ''}><option value="">No estimate</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option><option value="180">3 hours</option></select></label>
                <label>Repeat<select name="recurrence" defaultValue={task?.recurrence ?? 'NONE'}><option value="NONE">Does not repeat</option><option value="DAILY">Every day</option><option value="WEEKDAYS">Weekdays</option><option value="WEEKLY">Every week</option><option value="MONTHLY">Every month</option></select></label>
                <label className="checkbox-label"><input type="checkbox" name="important" defaultChecked={task?.important} /> Mark as important</label>
              </div>
            </details>

            <section className="editor-section note-picker-section">
              <div className="editor-section-heading"><span>03</span><div><h3>Linked notes</h3><p>Associations only—your Markdown remains read-only.</p></div></div>
              {selectedNotes.length > 0 && <div className="selected-note-chips">{selectedNotes.map((note) => <span key={note.id}><span><strong>{note.title}</strong><small>{note.folder || 'Vault root'}</small></span><button type="button" onClick={() => removeNote(note.id)} aria-label={'Unlink ' + note.title}><X size={13} /></button></span>)}</div>}
              {vaultUnavailable ? <div className="note-picker-state"><BookOpen size={17} /><span>The vault is temporarily unavailable. Existing links are preserved.</span></div> : !vaultStatus?.connection ? <div className="note-picker-state"><BookOpen size={17} /><span>Connect a development vault in Settings to link notes.</span></div> : <>
                <label className="note-search"><Search size={15} /><input value={noteSearch} onChange={(event) => { event.stopPropagation(); setNoteSearch(event.target.value); }} onKeyDown={searchKeyDown} placeholder="Search title, path, or tag" aria-label="Search Obsidian notes" /></label>
                {noteSearch.trim().length >= 2 && <div ref={resultRef} className="note-search-results" role="listbox" aria-label="Note search results">
                  {searchingNotes ? <p>Searching notes…</p> : noteResults.filter((note) => !selectedNotes.some((item) => item.id === note.id)).length ? noteResults.filter((note) => !selectedNotes.some((item) => item.id === note.id)).map((note) => <button type="button" role="option" aria-selected="false" key={note.id} onClick={() => addNote(note)}><Plus size={14} /><span><strong>{note.title}</strong><small>{note.folder || 'Vault root'}{note.tags.length ? ' · ' + note.tags.slice(0, 2).map(({ tag }) => '#' + tag.displayName).join(' ') : ''}</small></span></button>) : <p>No additional notes match “{noteSearch.trim()}”.</p>}
                </div>}
              </>}
            </section>

            {error && <div className="form-error" role="alert">{error}</div>}
          </div>

          <footer className="editor-sticky-footer">
            <span>{dirty ? 'Unsaved changes' : task ? 'No changes yet' : 'Ready to create'}</span>
            <div><button type="button" className="secondary-button" onClick={requestClose}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></div>
          </footer>
        </form>
      </section>
    </div>
  );
}


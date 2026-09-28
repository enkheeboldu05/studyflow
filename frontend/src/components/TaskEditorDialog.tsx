import { ChevronDown, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { todayKey } from '../lib/dates';
import type { StudyTask, Subject, TaskInput } from '../types';

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
  const formRef = useRef<HTMLFormElement>(null);

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
      setDirty(false);
      onSaved(saved.task, !task);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save task.');
    } finally {
      setSaving(false);
    }
  }

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


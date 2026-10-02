import { CalendarClock, Check, Clock3, Pencil, Repeat2, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { displayDate, durationLabel } from '../lib/dates';
import type { StudyTask } from '../types';
import { TaskEntries } from './TaskEntries';

interface TaskDetailsProps {
  task: StudyTask;
  onClose: () => void;
  onEdit: (task: StudyTask) => void;
  onToggle: (task: StudyTask) => void | Promise<void>;
  onDelete: (task: StudyTask) => void | Promise<void>;
}

const statusLabels = { TODO: 'Planned', IN_PROGRESS: 'In progress', COMPLETED: 'Completed' };
const repeatLabels = { NONE: 'Does not repeat', DAILY: 'Every day', WEEKDAYS: 'Weekdays', WEEKLY: 'Every week', MONTHLY: 'Every month' };

export function TaskDetails({ task, onClose, onEdit, onToggle, onDelete }: TaskDetailsProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      previous?.focus();
    };
  }, [onClose]);

  async function remove() {
    if (!window.confirm('Delete “' + task.title + '”? This cannot be undone.')) return;
    await onDelete(task);
  }

  const completed = task.status === 'COMPLETED';

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card task-details" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <header>
          <div>
            <p className="kicker">Task details</p>
            <h2 id="task-details-title">{task.title}</h2>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close task details"><X /></button>
        </header>

        {task.description && <p className="task-details-description">{task.description}</p>}

        <div className="task-details-facts">
          <div><span>Status</span><strong className={'status-value ' + task.status.toLocaleLowerCase()}>{statusLabels[task.status]}</strong></div>
          <div><span>Subject</span><strong>{task.subject?.name ?? 'Uncategorized'}</strong></div>
          {task.priority !== 'MEDIUM' && <div><span>Priority</span><strong className={task.priority === 'HIGH' ? 'priority-high' : ''}>{task.priority.toLocaleLowerCase()}</strong></div>}
          {task.important && <div><span>Flag</span><strong><Star size={13} fill="currentColor" /> Important</strong></div>}
          {task.scheduledDate && <div><span>Planned day</span><strong><CalendarClock size={13} /> {displayDate(task.scheduledDate, { year: 'numeric' })}</strong></div>}
          {task.dueDate && <div><span>Real deadline</span><strong><CalendarClock size={13} /> {displayDate(task.dueDate, { year: 'numeric' })}</strong></div>}
          {task.estimatedMinutes && <div><span>Estimated time</span><strong><Clock3 size={13} /> {durationLabel(task.estimatedMinutes)}</strong></div>}
          {task.recurrence !== 'NONE' && <div><span>Repeats</span><strong><Repeat2 size={13} /> {repeatLabels[task.recurrence]}</strong></div>}
        </div>

        <TaskEntries key={task.id} taskId={task.id} />

        <footer>
          <button className="detail-delete" onClick={remove}><Trash2 size={15} /> Delete</button>
          <div>
            <button className="secondary-button" onClick={() => onEdit(task)}><Pencil size={15} /> Edit task</button>
            <button className="primary-button" onClick={() => onToggle(task)}>
              {completed ? <><RotateCcw size={15} /> Reopen</> : <><Check size={15} /> Mark complete</>}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

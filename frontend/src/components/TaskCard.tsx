import { CalendarClock, Check, Clock3, MoreHorizontal, RotateCcw, Star } from 'lucide-react';
import { displayDate, durationLabel, todayKey } from '../lib/dates';
import type { StudyTask } from '../types';

interface TaskCardProps {
  task: StudyTask;
  compact?: boolean;
  draggable?: boolean;
  onToggle: (task: StudyTask) => void;
  onEdit?: (task: StudyTask) => void;
  onDragStart?: (task: StudyTask) => void;
}

export function TaskCard({ task, compact, draggable, onToggle, onEdit, onDragStart }: TaskCardProps) {
  const completed = task.status === 'COMPLETED';
  const overdue = task.dueDate && task.dueDate.slice(0, 10) < todayKey() && !completed;
  return (
    <article
      className={`task-card ${compact ? 'compact' : ''} ${completed ? 'completed' : ''}`}
      draggable={draggable}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/task-id', String(task.id)); onDragStart?.(task); }}
    >
      <button className="task-check" onClick={() => onToggle(task)} aria-label={completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>
        {completed ? <Check size={14} /> : null}
      </button>
      <div className="task-body">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          {task.important && <Star className="important-star" size={13} fill="currentColor" />}
        </div>
        <div className="task-meta">
          {task.subject && <span><i style={{ background: task.subject.color }} />{task.subject.name}</span>}
          {task.estimatedMinutes && <span><Clock3 size={12} />{durationLabel(task.estimatedMinutes)}</span>}
          {task.dueDate && <span className={overdue ? 'gentle-overdue' : ''}><CalendarClock size={12} />Due {displayDate(task.dueDate)}</span>}
          {task.rescheduleCount > 0 && <span title="Times moved"><RotateCcw size={11} />{task.rescheduleCount}</span>}
        </div>
      </div>
      {onEdit && <button className="icon-button task-menu" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`}><MoreHorizontal size={17} /></button>}
    </article>
  );
}

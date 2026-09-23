import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, dateKey, startOfWeek, todayKey } from '../lib/dates';
import type { StudyTask } from '../types';

interface CalendarPageProps {
  tasks: StudyTask[];
  weekStartsOn: number;
  onMove: (task: StudyTask, date: string) => void;
  onEdit: (task: StudyTask) => void;
  onNew: (date: string) => void;
}

type CalendarView = 'month' | 'year';

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function tasksForDate(tasks: StudyTask[]) {
  const grouped = new Map<string, StudyTask[]>();
  for (const task of tasks) {
    const key = task.scheduledDate?.slice(0, 10);
    if (!key) continue;
    grouped.set(key, [...(grouped.get(key) ?? []), task]);
  }
  return grouped;
}

export function CalendarPage({ tasks, weekStartsOn, onMove, onEdit, onNew }: CalendarPageProps) {
  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(() => monthStart(new Date()));
  const [dragged, setDragged] = useState<StudyTask | null>(null);
  const [dropTarget, setDropTarget] = useState('');

  const grouped = useMemo(() => tasksForDate(tasks), [tasks]);
  const gridStart = useMemo(() => startOfWeek(cursor, weekStartsOn), [cursor, weekStartsOn]);
  const monthDays = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)), [gridStart]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(new Date(2026, 0, 5), weekStartsOn), index)), [weekStartsOn]);

  function navigate(amount: number) {
    setCursor((current) => view === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + amount, 1)
      : new Date(current.getFullYear() + amount, current.getMonth(), 1));
  }

  function returnToToday() {
    setCursor(monthStart(new Date()));
  }

  function dropOn(key: string) {
    if (dragged && dragged.scheduledDate?.slice(0, 10) !== key) onMove(dragged, key);
    setDragged(null);
    setDropTarget('');
  }

  function openMonth(month: number) {
    setCursor(new Date(cursor.getFullYear(), month, 1));
    setView('month');
  }

  return (
    <div className="page-content calendar-page">
      <header className="page-heading calendar-heading">
        <div>
          <p className="kicker">See time clearly</p>
          <h1>Study <em>calendar.</em></h1>
          <p>Move tasks between dates without changing their deadlines.</p>
        </div>
        <div className="calendar-view-toggle" role="group" aria-label="Calendar view">
          <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Month</button>
          <button className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>Year</button>
        </div>
      </header>

      <section className="calendar-controls" aria-label="Calendar navigation">
        <div>
          <button className="icon-button" onClick={() => navigate(-1)} aria-label={view === 'month' ? 'Previous month' : 'Previous year'}><ChevronLeft /></button>
          <button className="calendar-today-button" onClick={returnToToday}>Today</button>
          <button className="icon-button" onClick={() => navigate(1)} aria-label={view === 'month' ? 'Next month' : 'Next year'}><ChevronRight /></button>
        </div>
        <h2>{view === 'month' ? cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : cursor.getFullYear()}</h2>
        <span>{tasks.filter((task) => task.scheduledDate?.startsWith(String(cursor.getFullYear()))).length} scheduled this year</span>
      </section>

      {view === 'month' ? (
        <section className="content-panel month-calendar">
          <div className="calendar-weekdays" aria-hidden="true">
            {weekdays.map((day) => <span key={day.getDay()}>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>)}
          </div>
          <div className="month-grid">
            {monthDays.map((day) => {
              const key = dateKey(day);
              const dayTasks = grouped.get(key) ?? [];
              const outside = day.getMonth() !== cursor.getMonth();
              return (
                <div
                  key={key}
                  className={'month-day ' + (outside ? 'outside ' : '') + (key === todayKey() ? 'today ' : '') + (dropTarget === key ? 'drop-target' : '')}
                  onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(key); }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(''); }}
                  onDrop={() => dropOn(key)}
                >
                  <header>
                    <button className="day-number" onClick={() => { setCursor(monthStart(day)); }} aria-label={day.toLocaleDateString()}>{day.getDate()}</button>
                    {dayTasks.length > 0 && <span>{dayTasks.length}</span>}
                    <button className="calendar-add" onClick={() => onNew(key)} aria-label={'Add task on ' + day.toLocaleDateString()}><Plus size={13} /></button>
                  </header>
                  <div className="calendar-task-list">
                    {dayTasks.slice(0, 4).map((task) => (
                      <button
                        key={task.id}
                        className={'calendar-task ' + (task.status === 'COMPLETED' ? 'completed' : '')}
                        draggable
                        onDragStart={(event) => { setDragged(task); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(task.id)); }}
                        onDragEnd={() => { setDragged(null); setDropTarget(''); }}
                        onClick={() => onEdit(task)}
                        title={task.title}
                      >
                        <i style={{ background: task.subject?.color ?? 'var(--primary)' }} />
                        <span>{task.title}</span>
                      </button>
                    ))}
                    {dayTasks.length > 4 && <button className="more-tasks" onClick={() => { setCursor(monthStart(day)); }}>+{dayTasks.length - 4} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="year-grid" aria-label={'Year ' + cursor.getFullYear()}>
          {Array.from({ length: 12 }, (_, month) => {
            const first = new Date(cursor.getFullYear(), month, 1);
            const start = startOfWeek(first, weekStartsOn);
            const days = Array.from({ length: 42 }, (_item, index) => addDays(start, index));
            const monthCount = tasks.filter((task) => task.scheduledDate?.startsWith(dateKey(first).slice(0, 7))).length;
            return (
              <article className="content-panel mini-month" key={month}>
                <button className="mini-month-heading" onClick={() => openMonth(month)}>
                  <strong>{first.toLocaleDateString(undefined, { month: 'long' })}</strong>
                  <span>{monthCount || '—'}</span>
                </button>
                <div className="mini-weekdays">{weekdays.map((day) => <span key={day.getDay()}>{day.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>)}</div>
                <div className="mini-days">
                  {days.map((day) => {
                    const key = dateKey(day);
                    const count = grouped.get(key)?.length ?? 0;
                    const outside = day.getMonth() !== month;
                    return <button key={key} className={(outside ? 'outside ' : '') + (key === todayKey() ? 'today ' : '') + (count ? 'has-tasks density-' + Math.min(count, 4) : '')} onClick={() => { setCursor(monthStart(day)); setView('month'); }} title={day.toLocaleDateString() + (count ? ': ' + count + ' tasks' : '')}>{day.getDate()}</button>;
                  })}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="calendar-legend"><CalendarDays size={14} /><span>Drag a task card onto another date to reschedule it.</span></div>
    </div>
  );
}


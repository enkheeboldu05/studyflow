import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { TaskCard } from '../components/TaskCard';
import { addDays, dateKey, startOfWeek, todayKey } from '../lib/dates';
import type { StudyTask } from '../types';

interface WeekPageProps {
  tasks: StudyTask[];
  inbox: StudyTask[];
  weekStartsOn: number;
  onMove: (task: StudyTask, date: string | null) => void | Promise<void>;
  onToggle: (task: StudyTask) => void;
  onEdit: (task: StudyTask) => void;
  onNew: (date?: string | null) => void;
  onWeekChange: (start: Date) => void;
}

export function WeekPage({ tasks, inbox, weekStartsOn, onMove, onToggle, onEdit, onNew, onWeekChange }: WeekPageProps) {
  const [week, setWeek] = useState(() => startOfWeek(new Date(), weekStartsOn));
  const [dragged, setDragged] = useState<StudyTask | null>(null);
  const [successfulDrop, setSuccessfulDrop] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  useEffect(() => {
    if (!successfulDrop) return;
    const timer = window.setTimeout(() => setSuccessfulDrop(null), 1400);
    return () => window.clearTimeout(timer);
  }, [successfulDrop]);
  function change(days: number) { const next = addDays(week, days); setWeek(next); onWeekChange(next); }
  async function drop(date: string | null) {
    const moving = dragged;
    setDragged(null);
    if (!moving || moving.scheduledDate?.slice(0, 10) === date) return;
    await onMove(moving, date);
    setSuccessfulDrop(date ?? 'backlog');
  }
  return (
    <div className="page-content week-page">
      <header className="page-heading week-heading"><div><p className="kicker">Plan with room to change</p><h1>Weekly <em>planner.</em></h1><p>Drag work between days. Your deadline will stay where it is.</p></div><div className="week-controls"><button onClick={() => change(-7)} aria-label="Previous week"><ChevronLeft /></button><button onClick={() => { const next = startOfWeek(new Date(), weekStartsOn); setWeek(next); onWeekChange(next); }}>This week</button><button onClick={() => change(7)} aria-label="Next week"><ChevronRight /></button></div></header>
      <div className="week-range">{days[0].toLocaleDateString(undefined, { month: 'long', day: 'numeric' })} — {days[6].toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      <div className="planner-shell">
        <section className="week-board">
          {days.map((day) => {
            const key = dateKey(day);
            const dayTasks = tasks.filter((task) => task.scheduledDate?.slice(0, 10) === key);
            const minutes = dayTasks.filter((task) => task.status !== 'COMPLETED').reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
            return <div className={`day-column ${key === todayKey() ? 'is-today' : ''} ${successfulDrop === key ? 'drop-success' : ''}`} key={key} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={() => drop(key)}>
              <header><div><span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>{day.getDate()}</strong></div><small>{minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'Open'}</small></header>
              <div className="day-tasks">{dayTasks.map((task) => <TaskCard compact draggable key={task.id} task={task} onDragStart={setDragged} onToggle={onToggle} onEdit={onEdit} />)}</div>
              <button className="day-add" onClick={() => onNew(key)}><Plus size={14} /> Add</button>
            </div>;
          })}
        </section>
        <aside className={`backlog-rail ${successfulDrop === 'backlog' ? 'drop-success' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => drop(null)}>
          <header><div><p className="kicker">Unscheduled</p><h2>Backlog</h2></div><span>{inbox.length}</span></header>
          <p>Keep ideas here until they have a real place in your week.</p>
          <div>{inbox.slice(0, 8).map((task) => <TaskCard compact draggable key={task.id} task={task} onDragStart={setDragged} onToggle={onToggle} onEdit={onEdit} />)}</div>
          <button className="day-add" onClick={() => onNew(null)}><Plus size={14} /> Capture task</button>
        </aside>
      </div>
    </div>
  );
}

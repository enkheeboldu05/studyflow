import { CheckCircle2, CircleDashed, Clock3, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DateStrip } from '../components/DateStrip';
import { QuickAdd } from '../components/QuickAdd';
import { TaskCard } from '../components/TaskCard';
import { addDays, dateKey, displayDate, durationLabel, greeting, startOfWeek, todayKey } from '../lib/dates';
import type { StudyTask, Subject, User } from '../types';

interface TodayPageProps {
  user: User;
  subjects: Subject[];
  tasks: StudyTask[];
  overdue: StudyTask[];
  upcoming: StudyTask[];
  stats: { completed: number; total: number };
  weekStartsOn: number;
  showCompleted: boolean;
  onRefresh: () => void;
  onToggle: (task: StudyTask) => void;
  onEdit: (task: StudyTask) => void;
  onNew: (date: string) => void;
}

interface TaskGroupProps {
  title: string;
  description: string;
  tasks: StudyTask[];
  onToggle: (task: StudyTask) => void;
  onEdit: (task: StudyTask) => void;
}

function TaskGroup({ title, description, tasks, onToggle, onEdit }: TaskGroupProps) {
  if (!tasks.length) return null;
  return (
    <section className="daily-task-group">
      <header><div><h3>{title}</h3><p>{description}</p></div><span>{tasks.length}</span></header>
      <div>{tasks.map((task) => <TaskCard key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />)}</div>
    </section>
  );
}

export function TodayPage({ user, subjects, tasks, overdue, upcoming, weekStartsOn, showCompleted, onRefresh, onToggle, onEdit, onNew }: TodayPageProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedKey = dateKey(selectedDate);
  const isToday = selectedKey === todayKey();
  const selectedTasks = useMemo(
    () => tasks.filter((task) => task.scheduledDate?.slice(0, 10) === selectedKey),
    [tasks, selectedKey],
  );
  const inProgress = selectedTasks.filter((task) => task.status === 'IN_PROGRESS');
  const planned = selectedTasks.filter((task) => task.status === 'TODO');
  const completed = selectedTasks.filter((task) => task.status === 'COMPLETED');
  const remainingMinutes = [...inProgress, ...planned].reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  const progress = selectedTasks.length ? Math.round((completed.length / selectedTasks.length) * 100) : 0;
  const weekStart = startOfWeek(selectedDate, weekStartsOn);
  const weekEnd = addDays(weekStart, 7);
  const completedThisWeek = tasks.filter((task) => {
    if (!task.completedAt) return false;
    const completedAt = new Date(task.completedAt);
    return completedAt >= weekStart && completedAt < weekEnd;
  }).length;
  const selectedLabel = isToday
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page-content today-page">
      <header className="page-heading today-heading">
        <div>
          <p className="kicker">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h1>{greeting()}, {user.username}.</h1>
          <p>A clear plan for the work that matters today.</p>
        </div>
        <button className="primary-button desktop-new" onClick={() => onNew(selectedKey)}><Plus size={17} /> Add task</button>
      </header>

      <DateStrip selectedDate={selectedDate} tasks={tasks} weekStartsOn={weekStartsOn} onSelect={setSelectedDate} />

      <section className="today-summary" aria-label="Daily summary">
        <article>
          <div className="summary-top"><span>{isToday ? "Today's progress" : 'Day progress'}</span><strong>{progress}%</strong></div>
          <div className="summary-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
          <small>{completed.length} of {selectedTasks.length} tasks completed</small>
        </article>
        <article>
          <div className="summary-icon"><Clock3 size={17} /></div>
          <div><span>Remaining workload</span><strong>{durationLabel(remainingMinutes) || 'No estimate'}</strong><small>{planned.length + inProgress.length} open tasks</small></div>
        </article>
        <article>
          <div className="summary-icon"><CheckCircle2 size={17} /></div>
          <div><span>Completed this week</span><strong>{completedThisWeek}</strong><small>Across all subjects</small></div>
        </article>
      </section>

      <QuickAdd subjects={subjects} scheduledDate={selectedKey} onAdded={onRefresh} />

      <div className="today-grid">
        <section className="content-panel main-task-panel">
          <div className="section-heading daily-list-heading">
            <div><p className="kicker">Daily plan</p><h2>{selectedLabel}</h2></div>
            <span>{planned.length + inProgress.length} remaining</span>
          </div>

          {selectedTasks.length ? (
            <div className="grouped-task-list">
              <TaskGroup title="In progress" description="Work you have already started" tasks={inProgress} onToggle={onToggle} onEdit={onEdit} />
              <TaskGroup title="Planned" description="Ready when you are" tasks={planned} onToggle={onToggle} onEdit={onEdit} />
              {showCompleted && <TaskGroup title="Completed" description="Finished on this day" tasks={completed} onToggle={onToggle} onEdit={onEdit} />}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <CheckCircle2 />
              <div><h3>This day is open.</h3><p>Empty time can be intentional. Add a task only if it belongs here.</p></div>
              <button className="secondary-button" onClick={() => onNew(selectedKey)}><Plus size={15} /> Add task</button>
            </div>
          )}
        </section>

        <aside className="today-aside">
          <section className="content-panel gentle-panel">
            <div className="section-heading small"><div><p className="kicker">Still open</p><h2>From earlier</h2></div><CircleDashed size={18} /></div>
            {overdue.slice(0, 4).map((task) => <TaskCard compact key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} />)}
            {overdue.length === 0 && <p className="small-empty">Nothing is waiting from earlier days.</p>}
          </section>
          <section className="content-panel upcoming-panel">
            <div className="section-heading small"><div><p className="kicker">Next seven days</p><h2>Coming up</h2></div></div>
            {upcoming.slice(0, 5).map((task) => <button key={task.id} onClick={() => onEdit(task)} className="upcoming-row"><span>{displayDate(task.scheduledDate, { weekday: 'short' })}</span><div><strong>{task.title}</strong><small>{task.subject?.name ?? 'Uncategorized'}</small></div></button>)}
            {upcoming.length === 0 && <p className="small-empty">The next seven days are clear.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

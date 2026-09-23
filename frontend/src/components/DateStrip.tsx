import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, dateKey, startOfWeek, todayKey } from '../lib/dates';
import type { StudyTask } from '../types';

interface DateStripProps {
  selectedDate: Date;
  tasks: StudyTask[];
  weekStartsOn: number;
  onSelect: (date: Date) => void;
}

export function DateStrip({ selectedDate, tasks, weekStartsOn, onSelect }: DateStripProps) {
  const weekStart = startOfWeek(selectedDate, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const selectedKey = dateKey(selectedDate);
  const currentKey = todayKey();
  const moveWeek = (offset: number) => onSelect(addDays(selectedDate, offset * 7));

  return (
    <section className="date-strip" aria-label="Choose a day">
      <button className="date-nav" onClick={() => moveWeek(-1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
      <div className="date-days">
        {days.map((day) => {
          const key = dateKey(day);
          const count = tasks.filter((task) => task.scheduledDate?.slice(0, 10) === key && task.status !== 'COMPLETED').length;
          return (
            <button
              key={key}
              className={`${key === selectedKey ? 'selected' : ''} ${key === currentKey ? 'today' : ''}`}
              onClick={() => onSelect(day)}
              aria-pressed={key === selectedKey}
              aria-label={`${day.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${count ? `, ${count} open tasks` : ''}`}
            >
              <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <strong>{day.getDate()}</strong>
              <i className={count ? 'has-tasks' : ''}>{count > 0 ? Math.min(count, 9) : ''}</i>
            </button>
          );
        })}
      </div>
      <button className="date-nav" onClick={() => moveWeek(1)} aria-label="Next week"><ChevronRight size={18} /></button>
      {selectedKey !== currentKey && <button className="return-today" onClick={() => onSelect(new Date())}>Today</button>}
    </section>
  );
}

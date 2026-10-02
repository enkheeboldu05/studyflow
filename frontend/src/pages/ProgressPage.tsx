import { CalendarCheck2, Clock3, ListChecks, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { addDays, dateKey, durationLabel } from '../lib/dates';

interface ProgressData {
  days: Record<string, { count: number; minutes: number }>;
  subjects: Record<string, { count: number; color: string }>;
  summary: { total: number; thisWeek: number; plannedMinutes: number };
}

export function ProgressPage({ progress }: { progress: ProgressData }) {
  const heatDays = useMemo(() => {
    const end = new Date();
    const start = addDays(end, -end.getDay() - 15 * 7);
    return Array.from({ length: 112 }, (_, index) => addDays(start, index));
  }, []);
  const today = dateKey(new Date());
  const heatWeeks = heatDays.filter((_, index) => index % 7 === 0);
  const subjectEntries = Object.entries(progress.subjects).sort((a, b) => b[1].count - a[1].count);
  const maxSubject = Math.max(1, ...subjectEntries.map(([, value]) => value.count));
  return (
    <div className="page-content progress-page">
      <header className="page-heading"><div><p className="kicker">A record, not a score</p><h1>Your <em>progress.</em></h1><p>Look for patterns in the work you actually completed.</p></div></header>
      <section className="progress-stats">
        <div><ListChecks /><span>Completed overall</span><strong>{progress.summary.total}</strong><small>recorded tasks</small></div>
        <div><CalendarCheck2 /><span>Last seven days</span><strong>{progress.summary.thisWeek}</strong><small>completed tasks</small></div>
        <div><Clock3 /><span>Planned effort</span><strong>{durationLabel(progress.summary.plannedMinutes) || '—'}</strong><small>completed this week</small></div>
      </section>
      <section className="content-panel heatmap-panel">
        <div className="section-heading"><div><p className="kicker">16 weeks · through today</p><h2>Task activity</h2></div><TrendingUp /></div>
        <p className="heat-summary">{progress.summary.thisWeek} tasks completed in the last seven days</p>
        <div className="heatmap-layout">
          <div className="heat-day-labels">{['Sun', '', 'Tue', '', 'Thu', '', 'Sat'].map((label, index) => <span key={index}>{label}</span>)}</div>
          <div>
            <div className="heat-month-labels">{heatWeeks.map((week, index) => <span key={dateKey(week)}>{index === 0 || week.getMonth() !== heatWeeks[index - 1].getMonth() ? week.toLocaleDateString(undefined, { month: 'short' }) : ''}</span>)}</div>
            <div className="heatmap">{heatDays.map((day) => {
              const key = dateKey(day);
              const count = progress.days[key]?.count ?? 0;
              const future = key > today;
              const label = `${day.toLocaleDateString()}: ${future ? 'Future day' : `${count} completed tasks`}`;
              return <div key={key} className={`heat-cell level-${Math.min(4, count)}${future ? ' heat-future' : ''}`} title={label} aria-label={label} tabIndex={future ? undefined : 0} />;
            })}</div>
          </div>
        </div>
        <div className="heat-legend"><span>Completed tasks:</span>{[0, 1, 2, 3, 4].map((level) => <span className="heat-legend-step" key={level}><i className={`heat-cell level-${level}`} />{level === 4 ? '4+' : level}</span>)}</div>
      </section>
      <section className="content-panel subject-progress">
        <div className="section-heading"><div><p className="kicker">Where your work went</p><h2>By subject</h2></div></div>
        {subjectEntries.length ? subjectEntries.map(([name, data]) => <div className="subject-bar" key={name}><div><i style={{ background: data.color }} /><strong>{name}</strong><span>{data.count} completed</span></div><div className="bar-track"><span style={{ width: `${(data.count / maxSubject) * 100}%`, background: data.color }} /></div></div>) : <div className="empty-state slim"><TrendingUp /><h3>Your record starts here.</h3><p>Completed tasks will gradually reveal your study rhythm.</p></div>}
      </section>
    </div>
  );
}

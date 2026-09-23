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
    const start = addDays(end, -111);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 119 }, (_, index) => addDays(start, index));
  }, []);
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
        <div className="section-heading"><div><p className="kicker">Past 16 weeks</p><h2>Study activity</h2></div><TrendingUp /></div>
        <div className="heatmap-layout"><div className="heat-day-labels"><span>Sun</span><span>Tue</span><span>Thu</span><span>Sat</span></div><div className="heatmap">{heatDays.map((day) => {
          const data = progress.days[dateKey(day)];
          const level = !data ? 0 : data.count >= 5 ? 4 : Math.min(4, data.count);
          return <div key={dateKey(day)} className={`heat-cell level-${level}`} title={`${day.toLocaleDateString()}: ${data?.count ?? 0} completed`} />;
        })}</div></div>
        <div className="heat-legend"><span>Quiet</span>{[0, 1, 2, 3, 4].map((level) => <i key={level} className={`heat-cell level-${level}`} />)}<span>Active</span></div>
      </section>
      <section className="content-panel subject-progress">
        <div className="section-heading"><div><p className="kicker">Where your work went</p><h2>By subject</h2></div></div>
        {subjectEntries.length ? subjectEntries.map(([name, data]) => <div className="subject-bar" key={name}><div><i style={{ background: data.color }} /><strong>{name}</strong><span>{data.count} completed</span></div><div className="bar-track"><span style={{ width: `${(data.count / maxSubject) * 100}%`, background: data.color }} /></div></div>) : <div className="empty-state slim"><TrendingUp /><h3>Your record starts here.</h3><p>Completed tasks will gradually reveal your study rhythm.</p></div>}
      </section>
    </div>
  );
}

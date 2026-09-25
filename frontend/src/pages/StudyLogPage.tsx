import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { addDays, dateKey, durationLabel, startOfWeek, todayKey } from '../lib/dates';
import type { StudyLog, StudyTimer } from '../types';

interface StudyLogPageProps {
  weekStartsOn: number;
}

interface DayDraft {
  target: string;
  actual: string;
}

function hoursValue(minutes: number) {
  if (!minutes) return '';
  return String(Number((minutes / 60).toFixed(2)));
}

function elapsed(timer: StudyTimer | null) {
  if (!timer) return 0;
  if (timer.status !== 'RUNNING' || !timer.startedAt) return timer.elapsedSeconds;
  return timer.elapsedSeconds + Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000));
}

function clockLabel(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, '0')).join(':');
}

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function studyLevel(minutes: number) {
  if (!minutes) return 0;
  if (minutes < 60) return 1;
  if (minutes < 180) return 2;
  if (minutes < 360) return 3;
  return 4;
}

export function StudyLogPage({ weekStartsOn }: StudyLogPageProps) {
  const [week, setWeek] = useState(() => startOfWeek(new Date(), weekStartsOn));
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));
  const [logs, setLogs] = useState<Record<string, StudyLog>>({});
  const [historyLogs, setHistoryLogs] = useState<Record<string, StudyLog>>({});
  const [drafts, setDrafts] = useState<Record<string, DayDraft>>({});
  const [timer, setTimer] = useState<StudyTimer | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [savingDate, setSavingDate] = useState('');
  const [historyLoading, setHistoryLoading] = useState(true);
  const [timerBusy, setTimerBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  const monthDays = useMemo(() => {
    const start = startOfWeek(month, weekStartsOn);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month, weekStartsOn]);
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 20 + ((weekStartsOn + index) % 7)).toLocaleDateString(undefined, { weekday: 'short' })), [weekStartsOn]);

  const loadWeek = useCallback(async () => {
    setError('');
    try {
      const data = await api.get<{ logs: StudyLog[]; timer: StudyTimer | null }>('/study-log?start=' + dateKey(week));
      const byDate = Object.fromEntries(data.logs.map((log) => [log.date, log]));
      setLogs(byDate);
      setDrafts(Object.fromEntries(days.map((day) => {
        const key = dateKey(day);
        const log = byDate[key];
        return [key, { target: hoursValue(log?.targetMinutes ?? 0), actual: hoursValue(log?.actualMinutes ?? 0) }];
      })));
      setTimer(data.timer);
      setTimerSeconds(elapsed(data.timer));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your study log.');
    }
  }, [days, week]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const start = dateKey(monthDays[0]);
      const end = dateKey(monthDays[monthDays.length - 1]);
      const data = await api.get<{ logs: StudyLog[] }>(`/study-log?start=${start}&end=${end}`);
      setHistoryLogs(Object.fromEntries(data.logs.map((log) => [log.date, log])));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your study history.');
    } finally {
      setHistoryLoading(false);
    }
  }, [monthDays]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  useEffect(() => { void loadWeek(); }, [loadWeek]);

  useEffect(() => {
    setTimerSeconds(elapsed(timer));
    if (!timer || timer.status !== 'RUNNING') return;
    const interval = window.setInterval(() => setTimerSeconds(elapsed(timer)), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function saveDay(date: string, field: keyof DayDraft) {
    const value = drafts[date]?.[field] ?? '';
    const hours = value === '' ? 0 : Number(value);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      setError('Enter a time between 0 and 24 hours.');
      return;
    }
    const property = field === 'target' ? 'targetMinutes' : 'actualMinutes';
    const minutes = Math.round(hours * 60);
    if (logs[date]?.[property] === minutes || (!logs[date] && minutes === 0)) return;
    setSavingDate(date);
    setError('');
    try {
      const { log } = await api.patch<{ log: StudyLog }>('/study-log/days/' + date, { [property]: minutes });
      setLogs((current) => ({ ...current, [date]: log }));
      setDrafts((current) => ({ ...current, [date]: { ...current[date], [field]: hoursValue(minutes) } }));
      void loadHistory();
      setMessage('Study log saved.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this day.');
    } finally {
      setSavingDate('');
    }
  }

  async function timerAction(action: 'start' | 'pause' | 'resume' | 'end') {
    setTimerBusy(true);
    setError('');
    try {
      if (action === 'start') {
        const result = await api.post<{ timer: StudyTimer }>('/study-log/timer/start', { date: todayKey() });
        setTimer(result.timer);
        setMessage('Study session started.');
      } else if (action === 'end') {
        const result = await api.post<{ log: StudyLog; loggedMinutes: number }>('/study-log/timer/end');
        setTimer(null);
        setTimerSeconds(0);
        void loadWeek();
        void loadHistory();
        setMessage(`${durationLabel(result.loggedMinutes) || 'Session'} added to your log.`);
      } else {
        const result = await api.post<{ timer: StudyTimer }>('/study-log/timer/' + action);
        setTimer(result.timer);
        setMessage(action === 'pause' ? 'Session paused.' : 'Session resumed.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the timer.');
    } finally {
      setTimerBusy(false);
    }
  }

  const weeklyActual = Object.values(logs).reduce((total, log) => total + log.actualMinutes, 0);
  const weeklyTarget = Object.values(logs).reduce((total, log) => total + log.targetMinutes, 0);
  const range = `${days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${days[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const monthPrefix = dateKey(month).slice(0, 7);
  const monthRecords = Object.values(historyLogs).filter((log) => log.date.startsWith(monthPrefix));
  const monthlyActual = monthRecords.reduce((total, log) => total + log.actualMinutes, 0);
  const studiedDays = monthRecords.filter((log) => log.actualMinutes > 0).length;
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="page-content study-log-page">
      <header className="page-heading study-log-heading">
        <div><p className="kicker">Simple time record</p><h1>Study <em>log.</em></h1><p>Set a daily target, record your actual time, or let the timer add it for you.</p></div>
      </header>

      <section className="study-timer content-panel">
        <div className="timer-copy"><Clock3 /><div><span>{timer ? timer.status === 'RUNNING' ? 'Studying now' : 'Session paused' : 'Ready when you are'}</span><strong>{clockLabel(timerSeconds)}</strong><small>{timer ? `Logging to ${new Date(timer.logDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'One session at a time'}</small></div></div>
        <div className="timer-actions">
          {!timer && <button className="primary-button" disabled={timerBusy} onClick={() => timerAction('start')}><Play size={15} /> Start session</button>}
          {timer?.status === 'RUNNING' && <button className="secondary-button" disabled={timerBusy} onClick={() => timerAction('pause')}><Pause size={15} /> Pause</button>}
          {timer?.status === 'PAUSED' && <button className="secondary-button" disabled={timerBusy} onClick={() => timerAction('resume')}><RotateCcw size={15} /> Resume</button>}
          {timer && <button className="primary-button" disabled={timerBusy} onClick={() => timerAction('end')}><Square size={14} /> End session</button>}
        </div>
      </section>

      {(error || message) && <div className={error ? 'form-error study-log-message' : 'study-log-success'} role={error ? 'alert' : 'status'}>{error || message}</div>}

      <section className="study-log-summary">
        <article className="content-panel"><span>Weekly studied</span><strong>{durationLabel(weeklyActual) || '0m'}</strong><small>{weeklyTarget ? `${durationLabel(weeklyTarget)} target` : 'No target set'}</small></article>
        <div className="week-controls"><button onClick={() => setWeek((current) => addDays(current, -7))} aria-label="Previous week"><ChevronLeft /></button><button onClick={() => setWeek(startOfWeek(new Date(), weekStartsOn))}>This week</button><button onClick={() => setWeek((current) => addDays(current, 7))} aria-label="Next week"><ChevronRight /></button></div>
      </section>

      <section className="content-panel study-log-table">
        <header><div><p className="kicker">Week</p><h2>{range}</h2></div><span>Hours</span></header>
        <div className="study-log-columns" aria-hidden="true"><span>Date</span><span>Study target</span><span>Actual studied</span><span>Status</span></div>
        {days.map((day) => {
          const key = dateKey(day);
          const draft = drafts[key] ?? { target: '', actual: '' };
          return (
            <div className={`study-log-row ${key === todayKey() ? 'today' : ''}`} key={key}>
              <div className="study-log-date"><strong>{day.toLocaleDateString(undefined, { weekday: 'long' })}</strong><span>{day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
              <label><span>Target</span><input type="number" min="0" max="24" step="0.25" inputMode="decimal" value={draft.target} placeholder="0" onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, target: event.target.value } }))} onBlur={() => saveDay(key, 'target')} /></label>
              <label><span>Actual</span><input type="number" min="0" max="24" step="0.25" inputMode="decimal" value={draft.actual} placeholder="0" onChange={(event) => setDrafts((current) => ({ ...current, [key]: { ...draft, actual: event.target.value } }))} onBlur={() => saveDay(key, 'actual')} /></label>
              <small>{savingDate === key ? 'Saving…' : logs[key] ? 'Saved' : 'Empty'}</small>
            </div>
          );
        })}
      </section>
      <section className="content-panel study-history">
        <header className="study-history-header">
          <div>
            <p className="kicker">Study history</p>
            <h2>{monthLabel}</h2>
            <p>Daily totals from completed timer sessions and manual adjustments.</p>
          </div>
          <div className="study-history-controls">
            <button onClick={() => setMonth((current) => addMonths(current, -1))} aria-label="Previous month"><ChevronLeft /></button>
            <input type="month" aria-label="Choose month and year" value={monthPrefix} onChange={(event) => event.target.value && setMonth(new Date(`${event.target.value}-01T12:00:00`))} />
            <button onClick={() => setMonth(firstOfMonth(new Date()))}>This month</button>
            <button onClick={() => setMonth((current) => addMonths(current, 1))} aria-label="Next month"><ChevronRight /></button>
          </div>
        </header>
        <div className="study-history-summary">
          <div><CalendarDays /></div>
          <div><strong>{historyLoading ? 'Loading…' : durationLabel(monthlyActual) || '0m'}</strong><span>{studiedDays} {studiedDays === 1 ? 'day' : 'days'} studied this month</span></div>
        </div>
        <div className="study-history-calendar">
        <div className="study-history-weekdays" aria-hidden="true">
          {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="study-history-grid" aria-busy={historyLoading}>
          {monthDays.map((day) => {
            const key = dateKey(day);
            const log = historyLogs[key];
            const outside = day.getMonth() !== month.getMonth();
            const minutes = log?.actualMinutes ?? 0;
            return (
              <div className={`study-history-day level-${studyLevel(minutes)} ${outside ? 'outside' : ''} ${key === todayKey() ? 'today' : ''}`} key={key} title={`${day.toLocaleDateString()}: ${durationLabel(minutes) || 'No study time'}`}>
                <span>{day.getDate()}</span>
                <strong>{minutes ? durationLabel(minutes) : '—'}</strong>
                <small>{log?.targetMinutes ? `${durationLabel(log.targetMinutes)} target` : 'No target'}</small>
              </div>
            );
          })}
        </div>
        </div>
      </section>
    </div>
  );
}

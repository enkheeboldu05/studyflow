import { Archive, Inbox, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QuickAdd } from '../components/QuickAdd';
import { TaskCard } from '../components/TaskCard';
import type { StudyTask, Subject } from '../types';

interface InboxPageProps {
  tasks: StudyTask[];
  subjects: Subject[];
  onRefresh: () => void;
  onToggle: (task: StudyTask) => void;
  onEdit: (task: StudyTask) => void;
  onNew: () => void;
  onArchive: (task: StudyTask) => void;
}

export function InboxPage({ tasks, subjects, onRefresh, onToggle, onEdit, onNew, onArchive }: InboxPageProps) {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  useEffect(() => {
    if (subject && !subjects.some((item) => item.id === Number(subject))) setSubject('');
  }, [subject, subjects]);
  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesText = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesText && (!subject || task.subjectId === Number(subject));
  }), [tasks, search, subject]);
  return (
    <div className="page-content inbox-page">
      <header className="page-heading"><div><p className="kicker">Nothing has to be decided immediately</p><h1>Inbox &amp; <em>backlog.</em></h1><p>Capture first. Give it a subject and a day when you are ready.</p></div><button className="primary-button desktop-new" onClick={onNew}><Plus size={17} /> Add task</button></header>
      <QuickAdd subjects={subjects} scheduledDate={null} onAdded={onRefresh} />
      <section className="content-panel inbox-panel">
        <div className="filter-row">
          <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your backlog" /></label>
          <select value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Filter by subject"><option value="">All subjects</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <span>{filtered.length} {filtered.length === 1 ? 'item' : 'items'}</span>
        </div>
        <div className="inbox-list">
          {filtered.map((task) => <div className="inbox-task-row" key={task.id}><TaskCard task={task} onToggle={onToggle} onEdit={onEdit} /><button className="icon-button" onClick={() => onArchive(task)} title="Archive"><Archive size={16} /></button></div>)}
          {filtered.length === 0 && <div className="empty-state"><Inbox /><h3>Your backlog is clear.</h3><p>Loose thoughts and unscheduled work will wait here.</p></div>}
        </div>
      </section>
    </div>
  );
}

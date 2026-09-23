import { BookOpen, CalendarDays, Inbox, LayoutList, LogOut, Menu, Plus, Settings, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import type { PageName, StudyTask, Subject, User } from '../types';

interface SidebarProps {
  user: User;
  page: PageName;
  subjects: Subject[];
  tasks: StudyTask[];
  inboxCount: number;
  onNavigate: (page: PageName) => void;
  onNewTask: () => void;
  onLogout: () => void;
}

const links: Array<{ page: PageName; label: string; icon: typeof LayoutList }> = [
  { page: 'today', label: 'Today', icon: LayoutList },
  { page: 'week', label: 'Weekly planner', icon: CalendarDays },
  { page: 'inbox', label: 'Inbox & backlog', icon: Inbox },
  { page: 'notes', label: 'Notes', icon: BookOpen },
  { page: 'progress', label: 'Progress', icon: TrendingUp },
  { page: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ user, page, subjects, tasks, inboxCount, onNavigate, onNewTask, onLogout }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const navigate = (next: PageName) => { onNavigate(next); setOpen(false); };
  return (
    <>
      <button className="mobile-menu-button" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu /></button>
      {open && <button className="mobile-nav-shade" onClick={() => setOpen(false)} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <header><a className="wordmark" href="#" onClick={(event) => { event.preventDefault(); navigate('today'); }}>Study<span>Flow</span></a><button className="mobile-close" onClick={() => setOpen(false)}><X /></button></header>
        <button className="new-task-button" onClick={onNewTask}><Plus size={18} /> New task</button>
        <nav aria-label="Main navigation">
          {links.map(({ page: target, label, icon: Icon }) => (
            <button key={target} className={page === target ? 'active' : ''} onClick={() => navigate(target)}>
              <Icon size={17} /><span>{label}</span>{target === 'inbox' && inboxCount > 0 && <b>{inboxCount}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-subjects">
          <div className="sidebar-label"><span>Subjects</span><button onClick={() => navigate('settings')} aria-label="Manage subjects"><Plus size={14} /></button></div>
          {subjects.slice(0, 7).map((subject) => {
            const count = tasks.filter((task) => task.subjectId === subject.id && task.status !== 'COMPLETED').length;
            return <div className="subject-row" key={subject.id}><i style={{ background: subject.color }} /><span>{subject.name}</span>{count > 0 && <b>{count}</b>}</div>;
          })}
          {subjects.length === 0 && <p>No active subjects</p>}
        </div>
        <footer>
          <div className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</div>
          <div><strong>{user.username}</strong><span>Local workspace</span></div>
          <button className="icon-button" onClick={onLogout} title="Log out"><LogOut size={16} /></button>
        </footer>
      </aside>
    </>
  );
}

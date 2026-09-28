import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { MorningCheckIn } from './components/MorningCheckIn';
import { Sidebar } from './components/Sidebar';
import { TaskDetails } from './components/TaskDetails';
import { TaskEditorDialog as TaskEditor } from './components/TaskEditorDialog';
import { api } from './lib/api';
import { isCustomTheme, themes } from './lib/themes';
import { todayKey } from './lib/dates';
import { InboxPage } from './pages/InboxPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { StudyLogPage } from './pages/StudyLogPage';
import { TodayPage } from './pages/TodayPage';
import { WeekPage } from './pages/WeekPage';
import type { AppTheme, PageName, StudyTask, Subject, User, UserSettings } from './types';

interface Dashboard {
  today: StudyTask[];
  overdue: StudyTask[];
  upcoming: StudyTask[];
  recent: StudyTask[];
  stats: { completed: number; total: number };
}

interface ProgressData {
  days: Record<string, { count: number; minutes: number }>;
  subjects: Record<string, { count: number; color: string }>;
  summary: { total: number; thisWeek: number; plannedMinutes: number };
}

const emptyDashboard: Dashboard = { today: [], overdue: [], upcoming: [], recent: [], stats: { completed: 0, total: 0 } };
const emptyProgress: ProgressData = { days: {}, subjects: {}, summary: { total: 0, thisWeek: 0, plannedMinutes: 0 } };
const fallbackSettings: UserSettings = { theme: 'SYSTEM', weekStartsOn: 1, defaultPage: 'today', showCompleted: true, morningCheckIn: true, automaticBackup: false };

function orderSubjects(items: Subject[]) {
  return [...items].sort((left, right) => {
    const archiveOrder = Number(Boolean(left.archivedAt)) - Number(Boolean(right.archivedAt));
    return archiveOrder || left.name.localeCompare(right.name);
  });
}

function upsertSubject(items: Subject[], subject: Subject) {
  return orderSubjects([...items.filter((item) => item.id !== subject.id), subject]);
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState<PageName>('today');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [progress, setProgress] = useState<ProgressData>(emptyProgress);
  const [checkIn, setCheckIn] = useState<{ needed: boolean; carryOver: StudyTask[] }>({ needed: false, carryOver: [] });
  const [editor, setEditor] = useState<{ task?: StudyTask | null; date?: string | null } | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [localTheme, setLocalTheme] = useState<AppTheme | null>(() => { const saved = localStorage.getItem('studyflow.theme'); return isCustomTheme(saved) ? saved : null; });
  const [toast, setToast] = useState('');
  const settings = user?.settings ?? fallbackSettings;

  const loadData = useCallback(async () => {
    const [me, subjectData, taskData, dashboardData, progressData, checkInData] = await Promise.all([
      api.get<{ user: User }>('/auth/me'),
      api.get<{ subjects: Subject[] }>('/subjects?archived=true'),
      api.get<{ tasks: StudyTask[] }>('/tasks'),
      api.get<Dashboard>('/dashboard'),
      api.get<ProgressData>('/progress'),
      api.get<{ needed: boolean; carryOver: StudyTask[] }>('/check-in'),
    ]);
    setUser(me.user);
    setSubjects(subjectData.subjects);
    setTasks(taskData.tasks);
    setDashboard(dashboardData);
    setProgress(progressData);
    setCheckIn(checkInData);
  }, []);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then(async ({ user: current }) => { setUser(current); setPage(String(current.settings?.defaultPage) === 'notes' ? 'today' : current.settings?.defaultPage ?? 'today'); await loadData(); })
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, [loadData]);

  useEffect(() => {
    const root = document.documentElement;
    const selected = localTheme ?? settings.theme;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      root.dataset.theme = selected === 'SYSTEM' ? (media.matches ? 'dark' : 'light') : selected.toLowerCase();
      root.style.colorScheme = ['dark', 'aubergine', 'ocean'].includes(root.dataset.theme) ? 'dark' : 'light';
    };
    apply();
    if (selected !== 'SYSTEM') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [localTheme, settings.theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeSubjects = subjects.filter((subject) => !subject.archivedAt);
  const inbox = tasks.filter((task) => !task.scheduledDate && task.status !== 'COMPLETED');
  const visibleTasks = settings.showCompleted ? tasks : tasks.filter((task) => task.status !== 'COMPLETED');
  const selectedTask = detailId ? tasks.find((task) => task.id === detailId) ?? null : null;

  async function authenticated(current: User) {
    setUser(current);
    await loadData();
  }

  async function toggleTask(task: StudyTask) {
    const status = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    await api.patch(`/tasks/${task.id}`, { status });
    setToast(status === 'COMPLETED' ? 'Task completed.' : 'Task reopened.');
    await loadData();
  }
  async function changeTheme(theme: AppTheme) {
    if (isCustomTheme(theme)) {
      localStorage.setItem('studyflow.theme', theme);
      setLocalTheme(theme);
      setToast(`${themes.find((item) => item.id === theme)?.name} theme applied.`);
      return;
    }
    localStorage.removeItem('studyflow.theme');
    setLocalTheme(null);
    await api.patch('/settings', { theme });
    setToast(`${theme === 'DARK' ? 'Dark' : theme === 'LIGHT' ? 'Light' : 'System'} theme applied.`);
    await loadData();
  }

  async function createSubject(input: { name: string; color: string }) {
    const { subject } = await api.post<{ subject: Subject }>('/subjects', { ...input, description: '' });
    setSubjects((current) => upsertSubject(current, subject));
    setToast(`“${subject.name}” added.`);
    return subject;
  }

  async function toggleSubjectArchive(subject: Subject) {
    const { subject: updated } = await api.patch<{ subject: Subject }>(`/subjects/${subject.id}`, { archived: !subject.archivedAt });
    setSubjects((current) => upsertSubject(current, updated));
    setToast(updated.archivedAt ? `“${updated.name}” archived.` : `“${updated.name}” restored.`);
  }

  async function removeSubject(subject: Subject) {
    await api.delete('/subjects/' + subject.id);
    setSubjects((current) => current.filter((item) => item.id !== subject.id));
    setToast(`“${subject.name}” deleted.`);
  }

  async function moveTask(task: StudyTask, scheduledDate: string | null) {
    await api.patch(`/tasks/${task.id}`, { scheduledDate });
    setToast(scheduledDate ? `Moved to ${new Date(`${scheduledDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}.` : 'Moved to backlog.');
    await loadData();
  }

  async function archiveTask(task: StudyTask) {
    await api.patch(`/tasks/${task.id}`, { archivedAt: new Date().toISOString() });
    setToast('Task archived.');
    await loadData();
  }

  async function deleteTask(task: StudyTask) {
    await api.delete('/tasks/' + task.id);
    setDetailId(null);
    setToast('Task deleted.');
    await loadData();
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  const todayProps = useMemo(() => ({
    ...dashboard,
    today: settings.showCompleted ? dashboard.today : dashboard.today.filter((task) => task.status !== 'COMPLETED'),
  }), [dashboard, settings.showCompleted]);

  if (checkingAuth) return <div className="app-loading"><div className="loading-mark">S</div><p>Opening StudyFlow…</p></div>;
  if (!user) return <AuthScreen onAuthenticated={authenticated} />;

  return (
    <div className="app-shell">
      <Sidebar user={user} page={page} subjects={activeSubjects} tasks={tasks} inboxCount={inbox.length} onNavigate={setPage} onNewTask={() => setEditor({ date: page === 'today' ? todayKey() : null })} onLogout={logout} />
      <main className="main-area">
        {page === 'today' && <TodayPage user={user} subjects={activeSubjects} tasks={tasks} weekStartsOn={settings.weekStartsOn} showCompleted={settings.showCompleted} {...todayProps} onRefresh={loadData} onToggle={toggleTask} onEdit={(task) => setDetailId(task.id)} onNew={(date) => setEditor({ date })} />}
        {page === 'week' && <WeekPage tasks={visibleTasks} inbox={inbox} weekStartsOn={settings.weekStartsOn} onMove={moveTask} onToggle={toggleTask} onEdit={(task) => setDetailId(task.id)} onNew={(date) => setEditor({ date })} onWeekChange={() => undefined} />}
        {page === 'calendar' && <CalendarPage tasks={visibleTasks} weekStartsOn={settings.weekStartsOn} onMove={moveTask} onEdit={(task) => setDetailId(task.id)} onNew={(date) => setEditor({ date })} />}
        {page === 'inbox' && <InboxPage tasks={inbox} subjects={activeSubjects} onRefresh={loadData} onToggle={toggleTask} onEdit={(task) => setDetailId(task.id)} onNew={() => setEditor({ date: null })} onArchive={archiveTask} />}
        {page === 'study-log' && <StudyLogPage weekStartsOn={settings.weekStartsOn} />}
        {page === 'progress' && <ProgressPage progress={progress} />}
        {page === 'settings' && <SettingsPage settings={settings} activeTheme={localTheme ?? settings.theme} subjects={subjects} onThemeChange={changeTheme} onSubjectCreate={createSubject} onSubjectToggleArchive={toggleSubjectArchive} onSubjectDelete={removeSubject} onUpdated={loadData} />}
      </main>
      {editor && <TaskEditor task={editor.task} defaultDate={editor.date} subjects={activeSubjects} onClose={() => setEditor(null)} onSaved={async (task, created) => { setEditor(null); setToast(created ? `“${task.title}” created.` : `“${task.title}” updated.`); await loadData(); }} />}
      {selectedTask && <TaskDetails task={selectedTask} onClose={() => setDetailId(null)} onToggle={toggleTask} onDelete={deleteTask} onEdit={(task) => { setDetailId(null); setEditor({ task }); }} />}
      {checkIn.needed && <MorningCheckIn tasks={checkIn.carryOver} username={user.username} onFinished={async () => { setCheckIn({ needed: false, carryOver: [] }); await loadData(); }} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

export default App;

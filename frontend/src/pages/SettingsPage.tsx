import { Archive, Download, Moon, Palette, Plus, RotateCcw, Sun, Terminal, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { VaultSettings } from '../components/VaultSettings';
import { api } from '../lib/api';
import type { AppTheme, Subject, UserSettings } from '../types';

interface SettingsPageProps {
  settings: UserSettings;
  activeTheme: AppTheme;
  subjects: Subject[];
  onThemeChange: (theme: AppTheme) => void | Promise<void>;
  onSubjectCreate: (input: { name: string; color: string }) => Promise<Subject>;
  onSubjectToggleArchive: (subject: Subject) => Promise<void>;
  onSubjectDelete: (subject: Subject) => Promise<void>;
  onUpdated: () => void | Promise<void>;
}

export function SettingsPage({ settings, activeTheme, subjects, onThemeChange, onSubjectCreate, onSubjectToggleArchive, onSubjectDelete, onUpdated }: SettingsPageProps) {
  const [error, setError] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [subjectColor, setSubjectColor] = useState('#65725b');
  const [savingSubject, setSavingSubject] = useState(false);
  const [pendingSubjectId, setPendingSubjectId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  async function update(data: Partial<UserSettings>) { try { await api.patch('/settings', data); await onUpdated(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update settings.'); } }
  async function addSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = subjectName.trim();
    if (!name) {
      setError('Enter a subject name.');
      return;
    }
    if (savingSubject) return;
    setSavingSubject(true);
    setError('');
    try {
      await onSubjectCreate({ name, color: subjectColor });
      setSubjectName('');
      setSubjectColor('#65725b');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add subject.');
    } finally {
      setSavingSubject(false);
    }
  }
  async function archiveSubject(subject: Subject) {
    if (pendingSubjectId !== null) return;
    setPendingSubjectId(subject.id);
    setError('');
    try {
      await onSubjectToggleArchive(subject);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update subject.');
    } finally {
      setPendingSubjectId(null);
    }
  }
  async function deleteSubject(subject: Subject) {
    if (pendingSubjectId !== null || !window.confirm(`Delete “${subject.name}”? Subjects with task history must be archived instead.`)) return;
    setPendingSubjectId(subject.id);
    setError('');
    try {
      await onSubjectDelete(subject);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete subject.');
    } finally {
      setPendingSubjectId(null);
    }
  }
  async function importBackup(file?: File) {
    if (!file || !window.confirm('Restore this backup? Your current subjects and tasks will be replaced.')) return;
    try { const payload = JSON.parse(await file.text()); await api.post('/backup/restore', payload); await onUpdated(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'That backup could not be restored.'); }
  }
  return (
    <div className="page-content settings-page">
      <header className="page-heading"><div><p className="kicker">Make it yours</p><h1>Workspace <em>settings.</em></h1><p>Keep the system quiet, familiar, and easy to return to.</p></div></header>
      {error && <div className="form-error settings-error">{error}</div>}
      <div className="settings-grid">
        <section className="content-panel settings-section">
          <div className="settings-title"><Palette /><div><h2>Appearance</h2><p>Choose how StudyFlow feels on this device.</p></div></div>
          <div className="theme-options"><button className={activeTheme === 'LIGHT' ? 'selected' : ''} onClick={() => onThemeChange('LIGHT')}><Sun />Light</button><button className={activeTheme === 'DARK' ? 'selected' : ''} onClick={() => onThemeChange('DARK')}><Moon />Dark navy</button><button className={activeTheme === 'AUBERGINE' ? 'selected' : ''} onClick={() => onThemeChange('AUBERGINE')}><Terminal />Aubergine</button><button className={activeTheme === 'SYSTEM' ? 'selected' : ''} onClick={() => onThemeChange('SYSTEM')}><RotateCcw />System</button></div>
          <label className="setting-row"><div><strong>Show completed tasks</strong><span>Keep today’s finished work visible.</span></div><input type="checkbox" checked={settings.showCompleted} onChange={(event) => update({ showCompleted: event.target.checked })} /></label>
          <label className="setting-row"><div><strong>Morning check-in</strong><span>Review unfinished work once each day.</span></div><input type="checkbox" checked={settings.morningCheckIn} onChange={(event) => update({ morningCheckIn: event.target.checked })} /></label>
        </section>
        <section className="content-panel settings-section subject-settings">
          <div className="settings-title"><Archive /><div><h2>Subjects</h2><p>Change these whenever your semester changes.</p></div></div>
          <div className="settings-subject-list">{subjects.map((subject) => <div key={subject.id}><i style={{ background: subject.color }} /><span><strong>{subject.name}</strong><small>{pendingSubjectId === subject.id ? 'Saving…' : `${subject._count?.tasks ?? 0} tasks`}</small></span><button className="icon-button" disabled={pendingSubjectId !== null} onClick={() => archiveSubject(subject)} title={subject.archivedAt ? 'Restore' : 'Archive'}>{subject.archivedAt ? <RotateCcw /> : <Archive />}</button><button className="icon-button danger" disabled={pendingSubjectId !== null} onClick={() => deleteSubject(subject)} title="Delete"><Trash2 /></button></div>)}</div>
          <form className="add-subject-form" onSubmit={addSubject}><input type="color" name="color" value={subjectColor} onChange={(event) => setSubjectColor(event.target.value)} aria-label="Subject color" disabled={savingSubject} /><input name="name" value={subjectName} onChange={(event) => setSubjectName(event.target.value)} required maxLength={60} placeholder="New subject" disabled={savingSubject} /><button disabled={savingSubject || !subjectName.trim()}><Plus size={16} /> {savingSubject ? 'Adding…' : 'Add'}</button></form>
        </section>
        <VaultSettings />
        <section className="content-panel settings-section data-settings">
          <div className="settings-title"><Download /><div><h2>Your data</h2><p>Keep a copy outside the SQLite database.</p></div></div>
          <div className="data-actions"><a className="secondary-button" href="/api/backup" download><Download />Export backup</a><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload />Restore backup</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={(event) => importBackup(event.target.files?.[0])} /></div>
          <p className="data-note">Backups contain your subjects, tasks, preferences, and account email—but never your password.</p>
        </section>
      </div>
    </div>
  );
}

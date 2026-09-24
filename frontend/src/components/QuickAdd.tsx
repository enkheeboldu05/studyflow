import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUp, CalendarPlus } from 'lucide-react';
import { api } from '../lib/api';
import type { Subject } from '../types';

interface QuickAddProps {
  subjects: Subject[];
  scheduledDate?: string | null;
  onAdded: () => void;
}

export function QuickAdd({ subjects, scheduledDate, onAdded }: QuickAddProps) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 1800);
    return () => window.clearTimeout(timer);
  }, [success]);
  async function add(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const addedTitle = title.trim();
      await api.post('/tasks', { title, subjectId: subjectId ? Number(subjectId) : null, scheduledDate: scheduledDate ?? null });
      setTitle('');
      setSuccess(`Added “${addedTitle}”.`);
      onAdded();
    } finally { setSaving(false); }
  }
  return (
    <form className="quick-add" onSubmit={add}>
      <CalendarPlus size={18} />
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={scheduledDate ? 'Add something for today…' : 'Capture something for later…'} aria-label="Task title" />
      <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} aria-label="Subject"><option value="">No subject</option>{subjects.map((subject) => <option value={subject.id} key={subject.id}>{subject.name}</option>)}</select>
      <button disabled={saving || !title.trim()} aria-label="Add task"><ArrowUp size={17} /></button>
      {success && <span className="quick-add-status" role="status">{success}</span>}
    </form>
  );
}

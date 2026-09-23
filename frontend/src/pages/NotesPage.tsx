import { ArrowUpRight, BookOpen, FileText, Folder, Link2, Search, Tags } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/api';
import type { Subject, VaultNote, VaultNoteDetail, VaultStatus, VaultTag } from '../types';

interface NotesMeta {
  folders: string[];
  tags: VaultTag[];
  properties: Array<{ normalizedName: string; name: string }>;
}

export function NotesPage({ subjects, onOpenSettings }: { subjects: Subject[]; onOpenSettings: () => void }) {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [meta, setMeta] = useState<NotesMeta>({ folders: [], tags: [], properties: [] });
  const [notes, setNotes] = useState<VaultNote[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<VaultNoteDetail | null>(null);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Array<{ rawTarget: string; url: string }>>([]);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [tag, setTag] = useState('');
  const [property, setProperty] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sort, setSort] = useState('title');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (folder) params.set('folder', folder);
    if (tag) params.set('tags', tag);
    if (subjectId) params.set('subjectId', subjectId);
    if (property) params.set('property', property);
    params.set('sort', sort);
    const result = await api.get<{ notes: VaultNote[] }>('/notes?' + params.toString());
    setNotes(result.notes);
    setSelectedId((current) => current && result.notes.some((note) => note.id === current) ? current : result.notes[0]?.id ?? null);
  }, [search, folder, tag, property, subjectId, sort]);

  useEffect(() => {
    Promise.all([api.get<VaultStatus>('/vault/status'), api.get<NotesMeta>('/notes/meta')])
      .then(([vault, noteMeta]) => { setStatus(vault); setMeta(noteMeta); return loadNotes(); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load notes.'))
      .finally(() => setLoading(false));
  }, [loadNotes]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setContent(''); return; }
    Promise.all([
      api.get<{ note: VaultNoteDetail }>('/notes/' + selectedId),
      api.get<{ content: string; attachments: Array<{ rawTarget: string; url: string }> }>('/notes/' + selectedId + '/content'),
    ]).then(([noteResult, contentResult]) => {
      setDetail(noteResult.note); setContent(contentResult.content); setAttachments(contentResult.attachments);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : 'This note is unavailable.'));
  }, [selectedId]);

  const attachmentMap = useMemo(() => new Map(attachments.map((item) => [item.rawTarget, item.url])), [attachments]);
  const openUri = detail ? 'obsidian://open?vault=' + encodeURIComponent(detail.vault.name) + '&file=' + encodeURIComponent(detail.relativePath.replace(/\.md$/i, '')) : '';

  if (loading) return <div className="page-content"><div className="notes-loading">Loading your note index…</div></div>;
  if (!status?.connection) return (
    <div className="page-content notes-page">
      <header className="page-heading"><div><p className="kicker">Knowledge workspace</p><h1>Your study <em>notes.</em></h1><p>Connect the configured read-only vault to begin indexing.</p></div></header>
      <div className="content-panel notes-empty"><BookOpen /><h2>No vault index yet</h2><p>Your tasks are unaffected. Connect and refresh the backup vault from Settings.</p><button className="primary-button" onClick={onOpenSettings}>Open settings</button></div>
    </div>
  );

  return (
    <div className="page-content notes-page">
      <header className="page-heading notes-heading"><div><p className="kicker">Knowledge workspace</p><h1>Your study <em>notes.</em></h1><p>{status.connection._count.notes} indexed notes from {status.connection.name}</p></div><a className="secondary-button" href={detail ? openUri : undefined} aria-disabled={!detail}><ArrowUpRight size={16} /> Open in Obsidian</a></header>
      {error && <div className="form-error settings-error">{error}</div>}
      {!status.available && <div className="vault-warning">The vault is currently unavailable. Existing metadata remains visible.</div>}
      <div className="notes-toolbar">
        <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes, paths, and properties" /></label>
        <select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">All tags</option>{meta.tags.map((item) => <option key={item.id} value={item.normalizedName}>#{item.displayName} ({item._count?.notes ?? 0})</option>)}</select>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <select value={property} onChange={(event) => setProperty(event.target.value)}><option value="">All properties</option>{meta.properties.map((item) => <option key={item.normalizedName} value={item.normalizedName}>{item.name}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="title">Title A–Z</option><option value="modified">Recently modified</option></select>
      </div>
      <div className="notes-workspace">
        <aside className="content-panel folder-browser">
          <div className="notes-panel-title"><Folder size={16} /><strong>Folders</strong></div>
          <button className={!folder ? 'active' : ''} onClick={() => setFolder('')}>All notes <span>{notes.length}</span></button>
          {meta.folders.map((item) => <button key={item} className={folder === item ? 'active' : ''} onClick={() => setFolder(item)} title={item}><span>{item.split('/').at(-1)}</span></button>)}
        </aside>
        <section className="content-panel note-results">
          <div className="notes-panel-title"><FileText size={16} /><strong>Notes</strong><span>{notes.length}</span></div>
          <div className="note-result-list">{notes.map((note) => <button key={note.id} className={selectedId === note.id ? 'active' : ''} onClick={() => setSelectedId(note.id)}><div><strong>{note.title}</strong>{note.isMap && <em>Map</em>}{note.isTemplate && <em>Template</em>}</div><small>{note.folder || 'Vault root'} · {new Date(note.modifiedAt).toLocaleDateString()}</small><span>{note.tags.slice(0, 3).map(({ tag: item }) => <i key={item.id}>#{item.displayName}</i>)}</span></button>)}</div>
          {!notes.length && <div className="small-empty">No notes match these filters.</div>}
        </section>
        <article className="content-panel note-reader">
          {detail ? <>
            <header><p className="kicker">{detail.isMap ? 'Map of content' : detail.isTemplate ? 'Template' : 'Note'}</p><h2>{detail.title}</h2><span>{detail.relativePath}</span></header>
            <div className="note-body"><Markdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => { const mapped = attachmentMap.get(src ?? ''); return mapped ? <img src={mapped} alt={alt ?? ''} loading="lazy" /> : <span className="missing-asset">Missing image: {alt || src}</span>; } }}>{content}</Markdown></div>
            <aside className="note-context">
              <section><h3><Tags size={14} /> Properties</h3>{detail.properties.length ? detail.properties.map((item) => <div className="property-row" key={item.id}><strong>{item.name}</strong><span>{item.value}</span></div>) : <p>No properties</p>}</section>
              <section><h3><Link2 size={14} /> Related</h3>{detail.outgoingLinks.filter((link) => link.targetNote).slice(0, 12).map((link) => <button key={link.id} onClick={() => setSelectedId(link.targetNote!.id)}>{link.targetNote!.title}</button>)}{detail.incomingLinks.slice(0, 12).map((link) => <button key={'back-' + link.id} onClick={() => setSelectedId(link.sourceNote.id)}>← {link.sourceNote.title}</button>)}</section>
              <section><h3>StudyFlow tasks</h3>{detail.taskLinks.length ? detail.taskLinks.map(({ task }) => <p key={task.id}>{task.title}</p>) : <p>No linked tasks yet.</p>}</section>
            </aside>
          </> : <div className="notes-empty"><BookOpen /><h2>Select a note</h2><p>Its safe read-only preview will appear here.</p></div>}
        </article>
      </div>
    </div>
  );
}

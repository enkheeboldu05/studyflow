import { ArrowUpRight, BookOpen, ChevronLeft, ChevronRight, FileText, Folder, Link2, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal, Tags, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../lib/api';
import type { Subject, VaultNote, VaultNoteDetail, VaultStatus, VaultTag } from '../types';

interface NotesMeta {
  folders: string[];
  tags: VaultTag[];
  properties: Array<{ normalizedName: string; name: string }>;
}
type InspectorTab = 'properties' | 'backlinks' | 'outgoing' | 'tasks';

export function NotesWorkspace({ subjects, onOpenSettings }: { subjects: Subject[]; onOpenSettings: () => void }) {
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
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [listWidth, setListWidth] = useState(290);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('properties');
  const [readingMode, setReadingMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams({ sort });
    if (search) params.set('search', search);
    if (folder) params.set('folder', folder);
    if (tag) params.set('tags', tag);
    if (property) params.set('property', property);
    if (subjectId) params.set('subjectId', subjectId);
    const result = await api.get<{ notes: VaultNote[] }>('/notes?' + params);
    setNotes(result.notes);
    setSelectedId((current) => current && result.notes.some((note) => note.id === current) ? current : result.notes[0]?.id ?? null);
  }, [search, folder, tag, property, subjectId, sort]);

  useEffect(() => {
    Promise.all([api.get<VaultStatus>('/vault/status'), api.get<NotesMeta>('/notes/meta')])
      .then(([vault, noteMeta]) => { setStatus(vault); setMeta(noteMeta); })
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not load the note index.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!status?.connection) return;
    const timer = window.setTimeout(() => loadNotes().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not filter notes.')), 120);
    return () => window.clearTimeout(timer);
  }, [loadNotes, status?.connection]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setContent(''); return; }
    setDetailLoading(true); setError('');
    Promise.all([
      api.get<{ note: VaultNoteDetail }>('/notes/' + selectedId),
      api.get<{ content: string; attachments: Array<{ rawTarget: string; url: string }> }>('/notes/' + selectedId + '/content'),
    ]).then(([noteResult, contentResult]) => {
      setDetail(noteResult.note); setContent(contentResult.content); setAttachments(contentResult.attachments);
    }).catch((caught) => {
      setDetail(null); setContent('');
      setError(caught instanceof Error ? caught.message : 'This note is unavailable.');
    }).finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!readingMode) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setReadingMode(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [readingMode]);

  const total = status?.connection?._count.notes ?? 0;
  const hasFilters = Boolean(search || folder || tag || property || subjectId);
  const attachmentMap = useMemo(() => new Map(attachments.map((item) => [item.rawTarget, item.url])), [attachments]);
  const openUri = detail ? 'obsidian://open?vault=' + encodeURIComponent(detail.vault.name) + '&file=' + encodeURIComponent(detail.relativePath.replace(/\.md$/i, '')) : '';
  const unresolved = detail?.outgoingLinks.filter((link) => !link.resolved) ?? [];
  const missingEmbeds = unresolved.filter((link) => link.embedded);
  const unresolvedNotes = unresolved.filter((link) => !link.embedded);
  const clearFilters = () => { setSearch(''); setFolder(''); setTag(''); setProperty(''); setSubjectId(''); };

  if (loading) return <div className="page-content"><div className="notes-loading">Opening your note index…</div></div>;
  if (!status?.connection) return <div className="page-content notes-page"><header className="page-heading"><div><p className="kicker">Knowledge workspace</p><h1>Your study <em>notes.</em></h1><p>Connect the configured read-only vault to begin indexing.</p></div></header><div className="content-panel notes-empty"><BookOpen /><h2>No vault index yet</h2><p>Your planning data is unaffected. Connect and refresh the backup vault from Settings.</p><button className="primary-button" onClick={onOpenSettings}>Open settings</button></div></div>;

  const layoutStyle = { '--note-list-width': listOpen ? listWidth + 'px' : '0px' } as CSSProperties;

  return (
    <div className={'page-content notes-page ' + (readingMode ? 'reading-mode' : '')}>
      <header className="page-heading notes-heading">
        <div><p className="kicker">Knowledge workspace</p><h1>Your study <em>notes.</em></h1><p><strong>{notes.length}</strong> shown · <strong>{total}</strong> total in {status.connection.name}</p></div>
        <div className="notes-heading-actions"><button className="secondary-button" onClick={() => setFoldersOpen((value) => !value)}>{foldersOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />} Folders</button><button className="secondary-button" onClick={() => setListOpen((value) => !value)}><FileText size={16} /> List</button></div>
      </header>
      {error && <div className="form-error settings-error">{error}</div>}
      {!status.available && <div className="vault-warning">The vault is currently unavailable. Cached metadata remains visible; previews will return after the drive is available.</div>}

      <div className="notes-toolbar">
        <label className="search-box"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search titles, paths, and properties" aria-label="Search notes" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={14} /></button>}</label>
        <select value={tag} onChange={(event) => setTag(event.target.value)} aria-label="Filter by tag"><option value="">All tags</option>{meta.tags.map((item) => <option key={item.id} value={item.normalizedName}>#{item.displayName} ({item._count?.notes ?? 0})</option>)}</select>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} aria-label="Filter by subject"><option value="">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
        <select value={property} onChange={(event) => setProperty(event.target.value)} aria-label="Filter by property"><option value="">All properties</option>{meta.properties.map((item) => <option key={item.normalizedName} value={item.normalizedName}>{item.name}</option>)}</select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort notes"><option value="title">Title A–Z</option><option value="modified">Recently modified</option></select>
      </div>

      <div className={'notes-workspace-v2 ' + (!foldersOpen ? 'folders-collapsed ' : '') + (!listOpen ? 'list-collapsed' : '')} style={layoutStyle}>
        {foldersOpen && <aside className="content-panel folder-browser">
          <div className="notes-panel-title"><Folder size={16} /><strong>Folders</strong><button className="icon-button" onClick={() => setFoldersOpen(false)} aria-label="Collapse folders"><ChevronLeft size={15} /></button></div>
          <button className={!folder ? 'active' : ''} onClick={() => setFolder('')}>All folders <span>{total}</span></button>
          {meta.folders.map((item) => <button key={item} className={folder === item ? 'active' : ''} onClick={() => setFolder(item)} title={item}><span>{item.split('/').at(-1)}</span><small>{item}</small></button>)}
        </aside>}

        {listOpen && <section className="content-panel note-results">
          <div className="notes-panel-title"><FileText size={16} /><strong>Notes</strong><span>{notes.length} / {total}</span><button className="icon-button" onClick={() => setListOpen(false)} aria-label="Collapse note list"><ChevronLeft size={15} /></button></div>
          <label className="note-list-size">List width<input type="range" min="240" max="420" value={listWidth} onChange={(event) => setListWidth(Number(event.target.value))} /></label>
          <div className="note-result-list">{notes.map((note) => <button key={note.id} className={selectedId === note.id ? 'active' : ''} onClick={() => setSelectedId(note.id)}><div><strong>{note.title}</strong>{note.isMap && <em>Map</em>}{note.isTemplate && <em>Template</em>}</div><small title={note.relativePath}>{note.relativePath}</small><span>{note.tags.slice(0, 3).map(({ tag: item }) => <i key={item.id}>#{item.displayName}</i>)}</span></button>)}</div>
          {!notes.length && <div className="notes-empty list-empty"><Search /><h2>No matching notes</h2><p>Try removing a filter or searching for part of a folder path.</p>{hasFilters && <button className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div>}
        </section>}

        <article className={'content-panel note-reader-v2 ' + (inspectorOpen ? 'inspector-open' : '')}>
          {!foldersOpen && !readingMode && <button className="workspace-edge-button left" onClick={() => setFoldersOpen(true)} aria-label="Show folders"><PanelLeftOpen size={17} /></button>}
          {!listOpen && !readingMode && <button className="workspace-edge-button second" onClick={() => setListOpen(true)} aria-label="Show note list"><ChevronRight size={17} /></button>}
          {detail ? <>
            <header className="reader-header">
              <div><p className="kicker">{detail.isMap ? 'Map of content' : detail.isTemplate ? 'Template' : 'Note'}</p><h2>{detail.title}</h2><span className="reader-path" title={detail.relativePath}>{detail.relativePath}</span></div>
              <div><a className="icon-button" href={openUri} title="Open in Obsidian" aria-label="Open in Obsidian"><ArrowUpRight size={17} /></a><button className="icon-button" onClick={() => setInspectorOpen((value) => !value)} title="Note information" aria-label="Toggle note information"><SlidersHorizontal size={17} /></button><button className="icon-button" onClick={() => setReadingMode((value) => !value)} title={readingMode ? 'Exit reading mode' : 'Reading mode'} aria-label={readingMode ? 'Exit reading mode' : 'Enter reading mode'}>{readingMode ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button></div>
            </header>
            {detailLoading ? <div className="notes-loading">Loading note…</div> : <div className="note-body document-body"><Markdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => { const mapped = attachmentMap.get(src ?? ''); return mapped ? <img src={mapped} alt={alt ?? ''} loading="lazy" /> : <span className="missing-asset">Unavailable image: {alt || src}</span>; }, a: ({ href, children }) => <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer">{children}</a> }}>{content}</Markdown></div>}
            {inspectorOpen && !readingMode && <aside className="note-inspector">
              <div className="inspector-tabs" role="tablist">
                {([['properties', 'Properties'], ['backlinks', 'Backlinks'], ['outgoing', 'Outgoing'], ['tasks', 'Tasks']] as Array<[InspectorTab, string]>).map(([key, label]) => <button key={key} role="tab" aria-selected={inspectorTab === key} className={inspectorTab === key ? 'active' : ''} onClick={() => setInspectorTab(key)}>{label}</button>)}
              </div>
              <div className="inspector-content">
                {inspectorTab === 'properties' && <section><h3><Tags size={14} /> Properties</h3>{detail.properties.length ? detail.properties.map((item) => <div className="property-row" key={item.id}><strong>{item.name}</strong><span>{item.value}</span></div>) : <p>No properties on this note.</p>}</section>}
                {inspectorTab === 'backlinks' && <section><h3>Backlinks <span>{detail.incomingLinks.length}</span></h3>{detail.incomingLinks.length ? detail.incomingLinks.map((link) => <button key={link.id} onClick={() => setSelectedId(link.sourceNote.id)}>← {link.sourceNote.title}</button>) : <p>No indexed notes link here.</p>}</section>}
                {inspectorTab === 'outgoing' && <section><h3><Link2 size={14} /> Outgoing links <span>{detail.outgoingLinks.length}</span></h3>{detail.outgoingLinks.filter((link) => link.targetNote).map((link) => <button key={link.id} onClick={() => setSelectedId(link.targetNote!.id)}>{link.targetNote!.title}</button>)}{missingEmbeds.length > 0 && <details><summary>{missingEmbeds.length} missing attachments</summary>{missingEmbeds.map((link) => <p key={link.id}>{link.rawTarget}</p>)}</details>}{unresolvedNotes.length > 0 && <details><summary>{unresolvedNotes.length} unresolved note links</summary>{unresolvedNotes.map((link) => <p key={link.id}>{link.rawTarget}</p>)}</details>}{!detail.outgoingLinks.length && <p>No outgoing links.</p>}</section>}
                {inspectorTab === 'tasks' && <section><h3>Related tasks <span>{detail.taskLinks.length}</span></h3>{detail.taskLinks.length ? detail.taskLinks.map(({ task }) => <div className="related-task" key={task.id}><strong>{task.title}</strong><span>{task.status.replace('_', ' ').toLocaleLowerCase()}</span></div>) : <p>No StudyFlow tasks link to this note.</p>}</section>}
              </div>
            </aside>}
          </> : <div className="notes-empty">{notes.length ? <><BookOpen /><h2>Select a note</h2><p>Choose a note to open its safe, read-only preview.</p></> : <><Search /><h2>Nothing to read yet</h2><p>Adjust the active filters to restore the note list.</p>{hasFilters && <button className="secondary-button" onClick={clearFilters}>Clear filters</button>}</>}</div>}
        </article>
      </div>
    </div>
  );
}

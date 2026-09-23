import { BookOpen, Database, RefreshCw, Unplug } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { VaultStatus } from '../types';

export function VaultSettings() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const load = () => api.get<VaultStatus>('/vault/status').then(setStatus).catch((error) => setMessage(error.message));
  useEffect(() => { load(); }, []);

  async function action(kind: 'connect' | 'refresh') {
    setBusy(kind); setMessage('');
    try {
      if (kind === 'connect') await api.post('/vault/connect');
      else {
        const result = await api.post<{ summary: { notes: number; attachments: number; warnings: number } }>('/vault/refresh');
        setMessage('Indexed ' + result.summary.notes + ' notes and ' + result.summary.attachments + ' attachments.');
      }
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Vault action failed.'); }
    finally { setBusy(''); }
  }

  async function disconnect(clearMetadata: boolean) {
    const prompt = clearMetadata ? 'Disconnect and clear the rebuildable note index? Vault files will not be changed.' : 'Disconnect this vault? Cached metadata will be kept.';
    if (!window.confirm(prompt)) return;
    setBusy('disconnect');
    try { await api.delete('/vault/connection', { clearMetadata }); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not disconnect vault.'); }
    finally { setBusy(''); }
  }

  return (
    <section className="content-panel settings-section data-settings vault-settings">
      <div className="settings-title"><BookOpen /><div><h2>Obsidian notes</h2><p>Read-only access to your configured local backup vault.</p></div></div>
      <div className="vault-status-row">
        <div className={'vault-status-dot ' + (status?.available ? 'ready' : '')} />
        <div><strong>{status?.connection?.name ?? 'Not connected'}</strong><span>{status?.available ? 'Vault available' : status?.configured ? 'Configured vault unavailable' : 'No local path configured'}</span></div>
        {status?.connection?._count && <div className="vault-counts"><span><b>{status.connection._count.notes}</b> notes</span><span><b>{status.connection._count.tags}</b> tags</span><span><b>{status.connection._count.attachments}</b> files</span></div>}
      </div>
      {status?.connection?.lastIndexedAt && <p className="data-note">Last refreshed {new Date(status.connection.lastIndexedAt).toLocaleString()}.</p>}
      {status?.connection?.lastError && <div className="form-error">{status.connection.lastError}</div>}
      {message && <p className="vault-message">{message}</p>}
      <div className="data-actions">
        {!status?.connection && <button className="primary-button" disabled={Boolean(busy) || !status?.configured} onClick={() => action('connect')}><Database size={15} />{busy === 'connect' ? 'Connecting…' : 'Connect vault'}</button>}
        {status?.connection && <button className="primary-button" disabled={Boolean(busy) || !status.available} onClick={() => action('refresh')}><RefreshCw size={15} />{busy === 'refresh' ? 'Reading vault…' : 'Refresh index'}</button>}
        {status?.connection && <button className="secondary-button" disabled={Boolean(busy)} onClick={() => disconnect(false)}><Unplug size={15} />Disconnect</button>}
        {status?.connection && <button className="text-button danger-text" disabled={Boolean(busy)} onClick={() => disconnect(true)}>Clear index</button>}
      </div>
      <p className="data-note">StudyFlow never writes to this vault. Refreshing reads changed Markdown and approved attachment metadata only.</p>
    </section>
  );
}

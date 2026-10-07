'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Upload, Download } from 'lucide-react';

type Document = { id: string; name: string; size: number; actor: string; created: string };
export function MachineDocuments({ machine, readOnly = false, onSessionChanged }: { readOnly?: boolean; machine: string; onSessionChanged: () => void }) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/documents?machine=${encodeURIComponent(machine)}`, { signal });
      const data = await response.json() as { documents: Document[]; error?: string };
      if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
      if (!response.ok) throw new Error(data.error);
      setDocuments(data.documents);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [machine, onSessionChanged]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || uploading) return;
    setError(''); setNotice('');
    if (file.size > 20 * 1024 * 1024) { setError('Le PDF dépasse la limite de 20 Mo.'); return; }
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Choisissez un fichier PDF.'); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.set('machine', machine); form.set('file', file);
      const response = await fetch('/api/documents', { method: 'POST', body: form });
      const data = await response.json() as { error?: string };
      if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
      if (!response.ok) throw new Error(data.error);
      setNotice(`${file.name} a été ajouté.`);
      setFile(null); if (input.current) input.current.value = '';
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Envoi impossible. Le fichier reste sélectionné pour réessayer.'); }
    finally { setUploading(false); }
  }

  return <section className="panel">
    <h2>Documents PDF</h2>
    <p className="muted">Notices, schémas et autres documents de cette machine.</p>
    {!readOnly && <form className="document-upload" onSubmit={upload}>
      <label htmlFor="machine-pdf">Choisir un PDF <small>20 Mo maximum par fichier</small></label>
      <input id="machine-pdf" ref={input} type="file" accept="application/pdf,.pdf" disabled={uploading}
        onChange={event => { setFile(event.target.files?.[0] || null); setError(''); setNotice(''); }}/>
      <button className="primary" disabled={!file || uploading}><Upload size={17}/>{uploading ? 'Envoi en cours…' : 'Ajouter le PDF'}</button>
    </form>}
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="document-notice">{notice}</p>}
    {loading ? <p>Chargement des documents…</p> : documents.length === 0 ? <div className="empty">Aucun document pour cette machine.</div> :
      <div className="table-wrap"><table>
        <thead><tr><th>Document</th><th>Ajouté par</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>{documents.map(document => <tr key={document.id}>
          <td><div className="document-name"><FileText size={19}/><strong>{document.name}</strong></div><small>{(document.size / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo</small></td>
          <td>{document.actor}</td><td>{new Date(document.created).toLocaleDateString('fr-FR')}</td>
          <td><div className="actions"><a href={`/api/documents/${document.id}`} target="_blank" rel="noreferrer">Ouvrir</a>
            <a href={`/api/documents/${document.id}?download=1`}><Download size={15}/>Télécharger</a></div></td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}

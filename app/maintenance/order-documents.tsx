'use client';
import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
type QuoteDocument = { id: string; name: string; size: number; actor: string };
export function OrderDocuments({ order, onSessionChanged }: { order: string; onSessionChanged: () => void }) {
  const [documents, setDocuments] = useState<QuoteDocument[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch('/api/order-documents?order=' + encodeURIComponent(order), { signal: controller.signal });
        const data = await response.json() as { documents: QuoteDocument[]; error?: string };
        if (response.status === 401 || response.status === 428) { onSessionChanged(); return; }
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setDocuments(data.documents); setError(''); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Chargement des PDF impossible.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [order, onSessionChanged]);
  return <section className="quote-documents"><h3>PDF du devis</h3>{error && <p role="alert" className="error">{error}</p>}
    {loading ? <p className="muted">Chargement des PDF…</p> : !documents.length ? <p className="muted">Aucun PDF joint.</p> : documents.map(document => <div className="quote-document" key={document.id}>
      <div><strong><FileText size={16} />{document.name}</strong><small>{(document.size / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo · {document.actor}</small></div>
      <div className="actions"><a href={'/api/order-documents/' + document.id} target="_blank" rel="noreferrer">Ouvrir</a><a href={'/api/order-documents/' + document.id + '?download=1'}>Télécharger</a></div>
    </div>)}
  </section>;
}

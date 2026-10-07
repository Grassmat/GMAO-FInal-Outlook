'use client';
import { useRef, useState } from 'react';
import { hiddenPreventiveQuestion } from '../../lib/interventions/types';
import { Trash2, Pencil } from 'lucide-react';
import type { Answer, Intervention, InterventionDeleteResult } from '../../lib/interventions/types';
const display = (value: Answer | undefined) => Array.isArray(value) ? value.join(', ') : value || '—';
export function ReportDetails({ report, onClose, onDeleted, onSessionChanged, onEdit }: { onEdit?: () => void; report: Intervention; onClose: () => void; onDeleted?: (result: InterventionDeleteResult) => void | Promise<void>; onSessionChanged?: () => void }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const deleting = useRef(false);
  async function remove() {
    if (deleting.current) return;
    deleting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/interventions/' + encodeURIComponent(report.id), { method: 'DELETE' });
      const data = await response.json() as InterventionDeleteResult & { error?: string };
      if (response.status === 401 || response.status === 428) { onSessionChanged?.(); return; }
      if (!response.ok) throw new Error(data.error || 'Suppression impossible.');
      await onDeleted?.(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.'); }
    finally { deleting.current = false; setBusy(false); }
  }
  return <div className="overlay"><div className="modal intervention-modal" role="dialog" aria-modal="true" aria-labelledby="report-title">
    <div className="panel-head"><h2 id="report-title">Rapport d’intervention</h2><div className="report-top-actions">{report.canEdit && onEdit && <button disabled={busy} onClick={onEdit}><Pencil size={16} />Modifier le rapport</button>}<button disabled={busy} onClick={onClose}>Fermer</button></div></div>
    <p><strong>{report.machines.map(m => m.name).join(', ')}</strong><small>Enregistré par {report.actor} · {report.source}</small></p>
    <section className="report-answer"><h3>État des machines</h3><p>{(report.machine_service || report.answers.service) === 'Non' ? 'Hors service' : (report.machine_service || report.answers.service) === 'Oui' ? 'En service' : 'État non renseigné'}</p>{report.waiting_note && <p>En attente de pièce : {report.waiting_note}</p>}{report.updated_at && <small>Rapport modifié le {new Date(report.updated_at).toLocaleString('fr-FR')}</small>}</section>
    {report.questions.filter(question => !hiddenPreventiveQuestion(question, report.answers)).map(question => <section className="report-answer" key={question.id}><h3>{question.label}</h3>{question.type === 'photos' ? <div className="report-photos">
      {report.files.filter(f => f.field === question.id).map(file => <a key={file.id} href={`/api/interventions/${report.id}/files/${file.id}`} target="_blank" rel="noreferrer"><img src={`/api/interventions/${report.id}/files/${file.id}`} alt={file.name} /><span>{file.name}</span></a>)}
      {Array.isArray(report.answers[question.id]) && (report.answers[question.id] as string[]).filter(link => link.startsWith('https://')).map((link, i) => <a key={link} href={link} target="_blank" rel="noreferrer">Photo historique {i + 1} (Google Drive)</a>)}
      {!report.files.some(f => f.field === question.id) && !(report.answers[question.id] as string[] | undefined)?.length && <p>—</p>}
    </div> : <p>{display(report.answers[question.id])}</p>}</section>)}
    {!!report.parts?.length && <section className="report-answer"><h3>Pièces utilisées</h3><div className="table-wrap"><table><thead><tr><th>Pièce</th><th>Référence</th><th>Quantité</th><th>Stock</th></tr></thead><tbody>{report.parts.map((part, index) => <tr key={index}><td>{part.name}</td><td>{part.reference || '—'}</td><td>{part.quantity}</td><td>{part.part ? 'Déduit du stock' : 'Non référencée'}</td></tr>)}</tbody></table></div></section>}
    {report.canDelete && onDeleted && <section className="report-answer">
      {confirming ? <><h3>Supprimer ce rapport ?</h3><p>Il disparaîtra des historiques du site et des machines. Les quantités prélevées par ce rapport seront remises en stock ; les autres mouvements seront conservés.</p>
        {!!report.parts?.some(part => part.part) && <ul>{report.parts.filter(part => part.part).map((part, index) => <li key={index}>{part.name} · {part.reference || 'Sans référence'} : +{part.quantity}</li>)}</ul>}
        <div className="actions"><button disabled={busy} onClick={() => setConfirming(false)}>Annuler</button><button className="danger" disabled={busy} onClick={remove}>{busy ? 'Suppression…' : 'Confirmer la suppression'}</button></div></>
        : <button className="danger" onClick={() => setConfirming(true)}><Trash2 size={16} />Supprimer le rapport</button>}
      {error && <p role="alert" className="error">{error}</p>}
    </section>}
  </div></div>;
}

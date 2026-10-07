'use client';
import { useRef, useState } from 'react';
import type { MaintenanceModel } from '../maintenance/use-maintenance';
async function post(model: MaintenanceModel, input: unknown) {
  const response = await fetch('/api/planning', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const data: any = await response.json();
  if (response.status === 401 || response.status === 428) model.onSessionChanged();
  if (!response.ok) throw Error(data.error || 'Enregistrement impossible.');
}
export function DeletePlanning({ model, item, kind, onDeleted }: { model: MaintenanceModel; item: { id: string; name: string; revision: number }; kind: 'plan' | 'routine'; onDeleted: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(false);
  async function remove() { if (pending.current) return; pending.current = true; setBusy(true); setError(''); try { await post(model, { action: 'delete', kind, id: item.id, revision: item.revision }); await onDeleted(); setConfirm(false); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Suppression impossible.'); } finally { pending.current = false; setBusy(false); } }
  return <div>{confirm ? <><p>Supprimer « {item.name} » {kind === 'routine' ? 'et arrêter ses prochaines occurrences' : 'du planning'} ? Cette suppression ne modifie pas le stock ni les rapports.</p><div className="actions"><button type="button" disabled={busy} onClick={() => setConfirm(false)}>Annuler</button><button type="button" className="danger" disabled={busy} onClick={remove}>{busy ? 'Suppression…' : 'Confirmer la suppression'}</button></div></> : <button type="button" className="danger" onClick={() => setConfirm(true)}>Supprimer {kind === 'routine' ? 'la tâche récurrente' : 'l’intervention planifiée'}</button>}{error && <p className="error" role="alert">{error}</p>}</div>;
}

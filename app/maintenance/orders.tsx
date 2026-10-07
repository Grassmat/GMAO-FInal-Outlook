'use client';
import { QuoteRequests } from './quote-approval';
import { useState } from 'react';
import { QuoteMail } from './quote-mail';
import type { Row } from '../../lib/maintenance/types';
import { Plus, PackageCheck, Trash2 } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
export function OrdersView({ model }: { model: MaintenanceModel }) {
  const [mail,setMail]=useState<Row|true|null>(null);
  const { tab, selected, site, records, setModal, saving } = model;
  if (tab !== 'Devis & achats' && !selected) return null;
  // D1 insertion order also covers older quotes without a creation timestamp.
  const orders = records.filter(row => row.kind === 'order' && !row.deleted && row.site === site && (!selected || row.machine === selected.id))
    .sort((a,b) => (b.creationOrder || 0) - (a.creationOrder || 0) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return <><section className="panel"><div className="panel-head"><h2>Devis & commandes</h2>{!model.readOnly&&<button onClick={()=>setMail(true)}>Demander un devis par mail</button>}{!model.readOnly && selected && <button onClick={() => setModal({ kind: 'order', site, clientId: crypto.randomUUID(), name: '', part: '', quantity: 1, machine: selected.id, status: 'Devis' })}><Plus size={16} />Ajouter</button>}</div>
    {!orders.length ? <div className="empty">Aucun devis enregistré.</div> : <div className="table-wrap"><table><thead><tr><th>Pièce / référence</th><th>Fournisseur</th><th>Quantité</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}>
      <td><strong>{order.name}</strong><small>{order.reference || 'Sans référence'} · {order.part ? 'Référence existante' : 'Nouvelle référence'}</small></td><td>{order.supplier || '—'}</td><td>{order.quantity ?? 'À préciser'}</td><td>{!model.readOnly&&order.status==='Devis'?<button className="badge" disabled={saving} title="Passer à Commandé" aria-label={'Passer à Commandé : '+order.name} onClick={()=>model.save({...order,status:'Commandé'})}>Devis</button>:<span className="badge">{order.status}</span>}{order.receivedAt && <small>Stock mis à jour</small>}</td>
      <td><div className="actions"><button onClick={() => setModal({ ...order, originalStatus: order.status })}>Fiche / PDF</button>{!model.readOnly&&<button onClick={()=>setMail(order)}>Demander par mail</button>}{!model.readOnly && order.status !== 'Reçu' && order.status !== 'Annulé' && <button disabled={saving} onClick={() => setModal({ ...order, originalStatus: order.status, quantity: order.quantity ?? 1, status: 'Reçu' })}><PackageCheck size={16} />Marquer reçu</button>}{model.user.role === 'admin' && <button className="danger" onClick={() => setModal({ action: 'delete-order', id: order.id, name: order.name, status: order.status })}><Trash2 size={16} />Supprimer</button>}</div></td>
    </tr>)}</tbody></table></div>}
  </section>{!selected&&<QuoteRequests model={model}/>} {mail&&!model.readOnly&&<QuoteMail model={model} order={mail===true?undefined:mail} onClose={()=>setMail(null)}/>}</>;
}

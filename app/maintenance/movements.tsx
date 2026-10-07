'use client';
import { Factory, Plus, Archive, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
export function MovementsView({ model }: {
  model: MaintenanceModel;
}) {
  const { tab, moves, site, records, machines } = model;
  return <> {tab === 'Magasin' && <section className="panel"><h2>Mouvements récents</h2>{moves.filter(m => m.site === site).slice(0, 30).map(m => <div className="movement" key={m.id}><b>{m.quantity > 0 ? '+' : ''}{m.quantity}</b><div>{records.find(p => p.id === m.part && p.kind === 'part')?.name || 'Référence historique'}<small>{m.reason} · {machines.find(x => x.id === m.machine)?.name || 'Magasin'} · {m.actor}</small></div><time>{new Date(m.created).toLocaleString('fr-FR')}</time></div>)}{!moves.some(m => m.site === site) && <div className="empty">Les entrées et sorties de stock apparaîtront ici.</div>}</section>}
  </>;
}

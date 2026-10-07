'use client';
import { Factory, Plus, Archive, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { MachineState } from './machine-state';
import type { MaintenanceModel } from './use-maintenance';
export function MachinesView({ model }: {
  model: MaintenanceModel;
}) {
  const { tab, selected, list, setSelected, parts } = model;
  return <> {tab === 'Machines' && !selected && <div className="grid">{list.map(m => <button className={'machine machine-'+(m.serviceState||'unknown')} key={m.id} onClick={() => setSelected(m)}><div className="machine-icon"><Factory size={25} /></div>{m.archived && <span className="status">Archivée</span>}<h2>{m.name}</h2><MachineState machine={m} orders={model.records.filter(r => r.kind === 'order' && !r.deleted)} /><p>{parts.filter(p => p.machines?.includes(m.id)).length} références compatibles</p><div className="machine-foot">Ouvrir la fiche <span>•••</span></div></button>)}{!list.length && <div className="empty">Aucune machine. Ajoutez votre premier équipement.</div>}</div>}
  </>;
}

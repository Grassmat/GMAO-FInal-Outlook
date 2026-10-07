
'use client';
import { Archive } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
export function MachineDetailsView({ model }: { model: MaintenanceModel }) {
  const { selected, save, saving } = model;
  if (!selected || model.readOnly) return null;
  return <section className="panel"><h2>Gestion de la machine</h2><button className="danger" onClick={() => save({ ...selected, archived: !selected.archived })} disabled={saving}><Archive size={16} />{selected.archived ? 'Réactiver la machine' : 'Archiver la machine'}</button><p className="muted">L’archivage conserve les pièces, devis, documents et interventions.</p></section>
}

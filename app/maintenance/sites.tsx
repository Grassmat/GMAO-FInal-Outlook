'use client';
import { Factory } from 'lucide-react';
import type { MaintenanceModel } from './use-maintenance';
export function SitesView({ model }: { model: MaintenanceModel }) {
  const { tab, sites, records, setModal, site } = model;
  if (tab !== 'Sites') return null;
  return <section className="panel">
    <h2>Blanchisseries</h2>
    {sites.map(s => <div className="order" key={s.id}>
      <Factory size={20} /><strong>{s.name}</strong>
      <span>{records.filter(r => r.kind === 'machine' && r.site === s.id && !r.archived).length} machines</span>
      <button onClick={() => setModal({ kind: 'site', id: s.id, site, name: s.name })}>Modifier le nom</button>
    </div>)}
    <p className="muted">Le changement de nom conserve les machines, les stocks et les comptes rattachés au site.</p>
  </section>;
}

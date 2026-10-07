'use client';
import { Plus, Search } from 'lucide-react';
import type { User } from '../../lib/maintenance/types';
import { PlanningView } from '../planning/view';
import { SiteMailSettings } from './site-mail-settings';
import { Users } from './users';
import { useMaintenance } from './use-maintenance';
import { MaintenanceShell } from './shell';
import { RecordEditor } from './record-editor';
import { MachinesView } from './machines';
import { StockView } from './stock';
import { OrdersView } from './orders';
import { MovementsView } from './movements';
import { InterventionsView } from './interventions';
import { SitesView } from './sites';
import { MachinePage } from './machine-page';
const descriptions = {
  Planning: 'Planifiez les interventions et vérifiez la disponibilité des pièces.',
  Machines: 'Le parc machines de votre blanchisserie.',
  Magasin: 'Une pièce, un stock partagé entre les machines compatibles.',
  Interventions: 'Les rapports et le formulaire de votre blanchisserie.',
  Sites: 'Ajoutez ou renommez les blanchisseries.',
  Utilisateurs: 'Gérez les comptes et les accès de votre équipe.',
  'Devis & achats': 'Suivez vos devis et vos commandes.',
};
export function MaintenanceWorkspace({ user, onSessionChanged, onAccount }: {
  user: User;
  onSessionChanged: () => void;
  onAccount: () => void;
}) {
  const model = useMaintenance(user, onSessionChanged);
  const { sites, tab, selected, setSelected, setModal, error, loading,
    machines, parts, qty, query, setQuery, archived, setArchived, load, add } = model;
  const creation = tab === 'Machines' ? { kind: 'machine', label: 'Ajouter une machine' }
    : tab === 'Magasin' ? { kind: 'part', label: 'Ajouter une pièce' }
      : tab === 'Sites' ? { kind: 'site', label: 'Ajouter un site' }
        : tab === 'Devis & achats' ? { kind: 'order', label: 'Ajouter un devis' } : null;
  return (
    <MaintenanceShell model={model} onAccount={onAccount} onSessionChanged={onSessionChanged}>
      <section className="heading">
        <div>
          <p className="eyebrow">GESTION DE LA MAINTENANCE</p>
          <h1>{selected?.name || tab}</h1>
          <p>{selected ? 'Pièces, devis, commandes et documents de cet équipement.' : descriptions[tab]}</p>
        </div>
        {!model.readOnly && !selected && creation && (
          <button className="primary" onClick={() => add(creation.kind)}>
            <Plus size={18} />{creation.label}
          </button>
        )}
        {!model.readOnly && selected && <button onClick={() => setModal({ ...selected })}>Modifier la machine</button>}
      </section>
      {model.readOnly && <p className="readonly-notice">Consultation uniquement sur ce site. Les modifications sont réservées à votre site.</p>}
      {error && <div role="alert" className="error">{error}<button onClick={load}>Réessayer</button></div>}
      {loading ? <p>Chargement du magasin…</p> : <>
        <div className="stats">
          <div><span>Machines en activité</span><strong>{String(machines.filter(m => !m.archived).length).padStart(2, '0')}</strong></div>
          <div><span>Références en magasin</span><strong>{String(parts.length).padStart(2, '0')}</strong></div>
          <div><span>À réapprovisionner</span><strong className="red">{String(parts.filter(p => qty(p.id) < (p.minimum || 0)).length).padStart(2, '0')}</strong></div>
        </div>
        {(tab === 'Machines' || tab === 'Magasin') && <div className="toolbar">
          {selected ? <button onClick={() => setSelected(null)}>Retour aux machines</button> : <div className="search">
            <Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)}
              placeholder={tab === 'Machines' ? 'Rechercher une machine…' : 'Nom ou référence de pièce…'} />
          </div>}
          {tab === 'Machines' && !selected && <label className="toggle">
            <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />Machines archivées
          </label>}
        </div>}
        <MachinesView model={model} />
        {!selected && <StockView model={model} />}
        {!selected && <OrdersView model={model} />}
        <MovementsView model={model} />
        <InterventionsView model={model} onSessionChanged={onSessionChanged} />
        {tab === 'Utilisateurs' && ['admin', 'director','manager'].includes(user.role) && <Users user={user} sites={sites} onSessionChanged={onSessionChanged} />}
        {tab==='Utilisateurs' && ['admin','director','manager'].includes(user.role) && <SiteMailSettings model={model} onConfigured={onSessionChanged}/>}
        <SitesView model={model} />
        {tab === 'Planning' && <PlanningView key={model.site} model={model} />}
        {selected && <MachinePage key={selected.id} model={model} onSessionChanged={onSessionChanged}/>}
      </>}
      <RecordEditor model={model} />
    </MaintenanceShell>
  );
}

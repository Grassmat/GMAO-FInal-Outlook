'use client';
import { branding } from '../../lib/branding';
import type { ReactNode } from 'react';
import { Factory, Package, ClipboardList, ShoppingCart, CalendarDays, Settings, Wrench, type LucideIcon } from 'lucide-react';
import { roleNames, type Tab } from '../../lib/maintenance/types';
import type { MaintenanceModel } from './use-maintenance';
export function MaintenanceShell({ model, children, onAccount, onSessionChanged }: {
  model: MaintenanceModel;
  children: ReactNode;
  onAccount: () => void;
  onSessionChanged: () => void;
}) {
  const { user, sites, site, setSite, tab, setTab, globalAccess, setSelected, setQuery } = model;
  const menu: [LucideIcon, Tab][] = [
    [CalendarDays, 'Planning'], [Factory, 'Machines'], [Package, 'Magasin'], [ClipboardList, 'Interventions'], [ShoppingCart, 'Devis & achats'],
  ];
  if (globalAccess) menu.push([Settings, 'Sites']);
  if (['admin', 'director', 'manager'].includes(user.role)) menu.push([Settings, 'Utilisateurs']);
  async function logout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    onSessionChanged();
  }
  return <div className="shell">
    <aside>
      <a className="brand" href="/"><img src={branding.logo} alt={branding.name} width="1000" height="217"/><small>MAINTENANCE</small></a>
      <div className="site-label">SITE</div>
      <select disabled={!globalAccess && user.role !== 'manager'} value={site} onChange={e => { setSite(e.target.value); setSelected(null); model.setModal(null); setQuery(''); }}>
        {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <nav>{menu.map(([Icon, label]) => <button key={label} className={tab === label ? 'active' : ''}
        onClick={() => { setTab(label); setSelected(null); setQuery(''); }}><Icon size={19} />{label}</button>)}</nav>
      <div className="aside-foot">{user.avatar_key?<img className="aside-avatar" src={'/api/profile/avatar?v='+user.avatar_version} alt="Votre photo"/>:<Wrench size={20} />}<div>{user.name}<small>{roleNames[user.role]}</small></div></div>
    </aside>
    <main>
      <header>
        <div className="breadcrumb">{branding.name} <span>/</span> {sites.find(s => s.id === site)?.name} <span>/</span> {tab}</div>
        <div className="account-actions"><button onClick={onAccount}>Mon profil</button><button onClick={logout}>Déconnexion</button></div>
      </header>
      {children}
      <footer>{branding.name} · Maintenance <span>Maintenance</span></footer>
    </main>
  </div>;
}

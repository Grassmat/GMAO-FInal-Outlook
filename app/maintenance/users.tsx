
'use client';
import { useState, useEffect } from 'react';
import { roleNames } from '../../lib/maintenance/types';
export function Users({ user, sites, onSessionChanged }: {
  user: {id:string;role:string};
  sites: any[];
  onSessionChanged: () => void;
}) {
  const [users, setUsers] = useState<any[]>([]), [loaded, setLoaded] = useState(false), [editing, setEditing] = useState<any>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function load() {
    try {
      const r = await fetch('/api/users');
      const d: any = await r.json();
      if (!r.ok)
        throw Error(d.error);
      setUsers(d.users);
      setLoaded(true);
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  // Fetch only when an authorized user opens this panel.
  useEffect(() => {
    setBusy(true);
    load().finally(() => setBusy(false));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/users', { method: user.role === 'manager' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) });
      const d: any = await r.json();
      if (!r.ok)
        throw Error(d.error);
      setEditing(null);
      await load();
      onSessionChanged();
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    finally {
      setBusy(false);
    }
  }
  async function remove(u: any) {
    if (!window.confirm(`Supprimer le compte de ${u.name} ? Ses rapports seront conservés.`)) return;
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/users', {method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:u.id})});
      const d: any = await r.json(); if (!r.ok) throw Error(d.error);
      await load();
    } catch(e) {setError(e instanceof Error ? e.message : String(e));}
    finally {setBusy(false);}
  }
  return <><section className="panel"><div className="panel-head"><h2>Utilisateurs</h2>{user.role !== 'manager' && <button className="primary" onClick={() => {
    setError('');
    setEditing({ name: '', username: '', password: '', role: 'technician', site: sites[0]?.id || '', active: true,test_account:false });
  }}>Ajouter un utilisateur</button>}</div><p className="muted">Chaque compte dispose de son identifiant, de son rôle et de son accès au site.</p>{error && !editing && <p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>Utilisateur</th><th>Identifiant</th><th>Rôle</th><th>Accès</th><th>État</th><th /></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.username}</td><td>{roleNames[u.role]}</td><td>{['admin', 'director'].includes(u.role) ? 'Tous les sites' : sites.find(s => s.id === u.site)?.name || 'Site indisponible'}</td><td>{u.active ? 'Actif' : 'Désactivé'}{!!u.test_account&&<small>Compte de test</small>}{u.change_password ? <small>Mot de passe à choisir</small> : null}</td><td>{(user.role === 'admin' || user.role === 'director' && u.role !== 'admin' || user.role === 'manager' && u.role === 'technician') && <><button disabled={busy} onClick={() => {
    setError('');
    setEditing({ ...u, active: !!u.active, password: '' });
  }}>{user.role==='manager'?'Modifier les permissions':'Modifier / mot de passe'}</button>{user.role!=='manager' && u.id !== user.id && <button className="danger" disabled={busy} onClick={() => remove(u)}>Supprimer</button>}</>}</td></tr>)}</tbody></table></div>{editing && <div className="overlay"><form className="modal" onSubmit={save}><div className="panel-head"><h2>{user.role==='manager'?'Permissions de '+editing.name:editing.id ? 'Modifier le compte' : 'Nouvel utilisateur'}</h2><button type="button" onClick={() => setEditing(null)}>Fermer</button></div>{user.role!=='manager'&&<><label>Nom<input required maxLength={100} value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label><label>Identifiant<input required pattern="[a-zA-Z0-9._\-]{3,40}" minLength={3} maxLength={40} autoComplete="off" value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} /><small>Lettres, chiffres, point, tiret ou souligné.</small></label><label>Rôle<select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>{Object.entries(roleNames).filter(([k]) => user.role === 'admin' || k !== 'admin').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>{!['admin', 'director'].includes(editing.role) && <label>Blanchisserie<select required value={editing.site || ''} onChange={e => setEditing({ ...editing, site: e.target.value })}><option value="">Choisir un site</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}<label>{editing.id ? 'Nouveau mot de passe provisoire (facultatif)' : 'Mot de passe provisoire'}<input type="password" required={!editing.id} minLength={6} maxLength={128} autoComplete="new-password" value={editing.password} onChange={e => setEditing({ ...editing, password: e.target.value })} /><small>À transmettre à l’utilisateur. Il le changera à sa première connexion.</small></label><label className="check"><input type="checkbox" checked={!!editing.test_account} onChange={e=>setEditing({...editing,test_account:e.target.checked})}/>Compte de test — adresse mail facultative</label><p className="muted">Le rôle et les droits restent identiques. Sans adresse mail, le mot de passe pourra être réinitialisé par l’admin ou le directeur.</p><label className="check"><input type="checkbox" checked={editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />Compte actif</label>{editing.id && <p className="muted">La modification du compte ferme ses sessions en cours.</p>}</>}{editing.role==='technician'&&<fieldset><legend>Permissions du technicien</legend><label className="check"><input type="checkbox" checked={!!editing.planning_create} onChange={e=>setEditing({...editing,planning_create:e.target.checked})}/>Créer et modifier les interventions planifiées et tâches récurrentes</label><label className="check"><input type="checkbox" checked={!!editing.quote_email} onChange={e=>setEditing({...editing,quote_email:e.target.checked})}/>Envoyer les demandes de devis sans validation préalable</label><p className="muted">Sans cette autorisation d’envoi, les demandes de devis sont soumises au responsable ou au directeur pour validation.</p></fieldset>}{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></form></div>}</section></>;
}

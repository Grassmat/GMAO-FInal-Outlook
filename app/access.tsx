
'use client';
import { branding } from '../lib/branding';
import { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, LogIn } from 'lucide-react';
import { roleNames } from '../lib/maintenance/types';
export function Access({ user, onSuccess }: {
  user?: any;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirm, setConfirm] = useState(''), [email,setEmail]=useState(user?.email||''), [forgot,setForgot]=useState(false),[message,setMessage]=useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (user && newPassword !== confirm) {
      setError('Les nouveaux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(forgot ? '/api/account-links' : '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(forgot ? {action:'forgot',identifier:username} : user ? { action: 'password', currentPassword: password, password: newPassword,email } : { username, password }) });
      const d: any = await r.json();
      if (!r.ok)
        throw Error(d.error);
      if(forgot){setMessage(d.message);return;}
      onSuccess();
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    finally {
      setBusy(false);
    }
  }
  return <div className="access-screen"><div className="access-brand"><img src={branding.logo} alt={branding.name} width="1000" height="217"/><p>Service maintenance</p></div><form className="access-card" onSubmit={submit}><div className="access-icon">{user ? <KeyRound size={26} /> : <ShieldCheck size={26} />}</div><h1>{forgot ? 'Mot de passe oublié' : user ? 'Votre mot de passe' : 'Connexion'}</h1><p>{forgot ? 'Saisissez votre identifiant ou votre adresse mail confirmée.' : user ? `${user.name}, choisissez un mot de passe personnel.` : 'Connectez-vous à votre blanchisserie.'}</p>{!user && <label>{forgot?'Identifiant ou adresse mail':'Identifiant'}<input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} maxLength={forgot?254:40} autoFocus /></label>}{!forgot && <label>{user ? 'Mot de passe actuel' : 'Mot de passe'}<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={128} /></label>}{user && <>{!user.email && !user.test_account && <label>Adresse mail *<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/><small>Vous pourrez la modifier dans votre profil.</small></label>}<label>Nouveau mot de passe<input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><label>Confirmer le nouveau mot de passe<input required type="password" minLength={6} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label><small>Au moins 6 caractères. Vous pouvez utiliser une phrase.</small></>}{message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}<button className="primary" disabled={busy}><LogIn size={18} />{busy ? 'Vérification…' : forgot ? 'Recevoir le lien' : user ? 'Enregistrer mon mot de passe' : 'Se connecter'}</button>{!user && <button type="button" onClick={()=>{setForgot(!forgot);setError('');setMessage('');}}>{forgot?'Retour à la connexion':'Mot de passe oublié ?'}</button>}{user && <button type="button" onClick={async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    onSuccess();
  }}>Déconnexion</button>}</form><p className="access-help">Pour obtenir un accès, contactez votre administrateur.</p></div>;
}

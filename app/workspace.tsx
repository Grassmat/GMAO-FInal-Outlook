'use client';
import { QuoteReview } from './maintenance/quote-approval';
import { AccountProfile } from './account-profile';
import { AccountLink } from './account-link';


import { useEffect, useState, useCallback } from 'react';
import { Access } from './access';
import type { User } from '../lib/maintenance/types';
import { MaintenanceWorkspace } from './maintenance/workspace';
export default function Workspace() {
  const [user, setUser] = useState<User | null | undefined>(undefined), [account, setAccount] = useState(false), [error, setError] = useState('');
  const [quoteReview,setQuoteReview]=useState('');
  const [mailReady,setMailReady]=useState(false),[link,setLink]=useState<{purpose:'reset'|'verify'|'sender';token:string}|null>(null);
  useEffect(()=>{const review=window.location.hash.match(/^#quote-approval=([a-f0-9-]{36})$/);if(review){setQuoteReview(review[1]);history.replaceState(null,'',window.location.pathname);}const match=window.location.hash.match(/^#(reset|verify|sender)=([a-f0-9]{64})$/);if(match){setLink({purpose:match[1] as 'reset'|'verify'|'sender',token:match[2]});history.replaceState(null,'',window.location.pathname);}},[]);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/auth');
      const d: any = await r.json();
      if (r.status === 401) {
        setUser(null);
        setAccount(false);
        return;
      }
      if (!r.ok)
        throw Error(d.error);
      setUser(d.user);
      setMailReady(d.mailReady===true);
    }
    catch (e) {
      setError('Connexion indisponible. Réessayez dans quelques instants.');
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  if(link)return <AccountLink link={link} onDone={()=>{setLink(null);refresh();}}/>;
  if (error)
    return <div className="access-screen"><div className="access-card"><p className="error">{error}</p><button onClick={() => {
      setError('');
      refresh();
    }}>Réessayer</button></div></div>;
  if (user === undefined)
    return <div className="access-screen">Chargement…</div>;
  if (!user)
    return <Access onSuccess={refresh} />;
  if (user.change_password)
    return <><Access user={user} onSuccess={refresh} />{!user.change_password && <button className="account-back" onClick={() => setAccount(false)}>Retour à la GMAO</button>}</>;
  if((!user.email && !user.test_account) || account)return <AccountProfile user={user} mailReady={mailReady} onRefresh={refresh} onClose={()=>setAccount(false)}/>;
  return <><MaintenanceWorkspace key={user.id} user={user} onSessionChanged={refresh} onAccount={() => setAccount(true)} />{quoteReview&&<QuoteReview id={quoteReview} onClose={()=>setQuoteReview('')}/>}</>;
}

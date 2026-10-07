'use client';
import { useState } from 'react';
import { MailConfiguration } from './mail-configuration';
import { QuoteMailPermissions } from './quote-mail';
import type { MaintenanceModel } from './use-maintenance';
export function SiteMailSettings({model,onConfigured}:{model:MaintenanceModel;onConfigured:()=>void}){
 const global=['admin','director'].includes(model.user.role);
 const [selected,setSelected]=useState(model.site);
 const site=global?selected:(model.user.site||'');
 const scoped={...model,site,readOnly:false};
 return <section className="panel"><h2>Réglages mails</h2>{global&&<MailConfiguration global onConfigured={onConfigured}/>}{global?<label>Site à configurer<select value={site} onChange={e=>setSelected(e.target.value)}>{model.sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>:<p>Réglages de votre site : {model.sites.find(s=>s.id===site)?.name}</p>}{site&&<><MailConfiguration key={'connection:'+site} site={site} onConfigured={onConfigured}/><QuoteMailPermissions key={'permissions:'+site} model={scoped}/></>}</section>;
}

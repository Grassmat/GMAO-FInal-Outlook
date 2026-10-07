import { database } from '../store';
import { mailReady, sendMail, applicationLink } from './provider';
import { routineOccurs, planningMachines } from '../planning/routines-client';
import { interventionToday } from '../interventions/types';
import type { Assignment, Routine } from '../planning/types';
type Recipient={id:string;email:string;email_verified:number;name:string};
async function recipients(site:string,assignment?:Assignment) {
 const rows=await database().prepare("SELECT id,email,email_verified,name FROM users WHERE active=1 AND role<>'admin' AND (site=? OR role='director')").bind(site).all<Recipient>();
 if(!assignment||assignment.mode==='any')return [];
 return rows.results.filter(u=>assignment.mode==='all'||assignment.users.includes(u.id));
}
async function summary(site:string,data:any,occurrence?:string) {
 const rows=await database().prepare("SELECT id,data,kind FROM records WHERE site=? OR (kind='site' AND id=?)").bind(site,site).all<any>();
 const records=new Map<string,any>(rows.results.map(r=>[r.id,JSON.parse(r.data)]));
 const date=occurrence||data.date;
 const dateLabel=date?new Date(date+'T12:00:00Z').toLocaleDateString('fr-FR',{timeZone:'UTC'}):'Date à définir';
 const lines=['Site : '+(records.get(site)?.name||site),'Machines : '+planningMachines(data).map(id=>records.get(id)?.name||'Machine indisponible').join(', '),'Date : '+dateLabel+(data.time?' à '+data.time:''),data.work?'Travaux prévus : '+data.work:'',data.instructions?'Consignes : '+data.instructions:''];
 for(const r of data.requirements||[]) {const part=records.get(r.part||r.order);lines.push('Pièce / devis : '+(part?.name||'Référence indisponible')+' · '+(part?.reference||'Sans référence')+' · quantité '+r.quantity);}
 if(data.equipment)lines.push('Équipement : '+data.equipment);
 return lines.filter(Boolean).join('\n');
}
async function enqueue(record:any,kind:string,occurrence='',moment='') {
 const data=JSON.parse(record.data),people=await recipients(record.site,data.assignment);
 const text=await summary(record.site,data,occurrence);
 let queued=0,missing=0;
 for(const u of people) {
  if(!u.email||!u.email_verified){missing++;continue;}
  const key=kind+':'+record.id+':'+occurrence+':'+moment+':'+u.id;
  const label=kind==='plan'?'Nouvelle intervention planifiée':moment==='before'?'Rappel pour demain':'Rappel pour aujourd’hui';
  const body='Bonjour '+u.name+',\n\n'+label+' : '+data.name+'\n\n'+text+'\n\nConsultez le planning dans la GMAO.';
  await database().prepare('INSERT OR IGNORE INTO email_outbox(id,user_id,record_id,kind,occurrence,email,subject,body,created) VALUES(?,?,?,?,?,?,?,?,?)').bind(key,u.id,record.id,kind,occurrence,u.email,'GMAO — '+label+' : '+data.name,body,Date.now()).run();queued++;
 }
 return {queued,missing};
}
export async function queuePlanNotification(id:string) {
 const record=await database().prepare("SELECT id,site,data FROM records WHERE id=? AND kind='plan'").bind(id).first<any>();
 if(!record || JSON.parse(record.data).deleted || !JSON.parse(record.data).notifyEmail || JSON.parse(record.data).status!=='planned')return {queued:0,missing:0};
 return enqueue(record,'plan');
}
export async function queueRoutineReminders(today=interventionToday()) {
 const tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 const next=tomorrow.toISOString().slice(0,10),db=database();
 const rows=await db.prepare("SELECT id,site,data FROM records WHERE kind='routine' AND COALESCE(json_extract(data,'$.deleted'),0)=0").all<any>();
 let queued=0;
 for(const r of rows.results) {
  const routine={...JSON.parse(r.data),id:r.id,site:r.site} as Routine;
  for(const [moment,date] of [['same',today],['before',next]]) {
   if(routine.emailReminder!==moment && routine.emailReminder!=='both')continue;
   if(!routineOccurs(routine,date))continue;
   if(await db.prepare("SELECT id FROM records WHERE id=? AND kind='routine_done'").bind('routine-done:'+r.id+':'+date).first())continue;
   queued+=(await enqueue(r,'routine',date,moment)).queued;
  }
 }
 return queued;
}
// Reconcile accepted supplier sends, including a send whose acknowledgement was saved before a restart.
export async function createSentQuotes(site=''){
 const db=database();
 // Before structured product fields existed, the standard mail template carried these values.
 // Recover only complete, unambiguous templates from confirmed supplier sends.
 const legacy=await db.prepare("SELECT q.* FROM quote_requests q JOIN email_outbox e ON e.id='quote:'||q.id WHERE e.state='accepted' AND q.state='approved' AND q.order_data IS NULL AND (?='' OR q.site=?)").bind(site,site).all<any>();
 for(const q of legacy.results){
  const name=q.body.match(/^Produit : (.+)$/m)?.[1]?.trim(),reference=q.body.match(/^Référence : (.*)$/m)?.[1]?.trim(),quantityText=q.body.match(/^Quantité : (\d+)\s*$/m)?.[1];
  const quantity=Number(quantityText);
  if(!name||name.startsWith('[')||reference===undefined||!quantityText||!Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)continue;
  const existing=await db.prepare("SELECT id FROM records WHERE kind='order' AND site=? AND json_extract(data,'$.name')=? AND json_extract(data,'$.reference')=? AND json_extract(data,'$.quantity')=? AND COALESCE(json_extract(data,'$.deleted'),0)=0 LIMIT 1").bind(q.site,name,reference,quantity).first<any>();
  const data=JSON.stringify({name,reference:reference.startsWith('[')?'':reference,quantity,supplier:q.recipient,machine:'',part:'',status:'Devis',revision:1,mailRequest:q.id,recipient:q.recipient,mailSubject:q.subject,mailBody:q.body,existingOrder:existing?.id||''});
  await db.prepare('UPDATE quote_requests SET order_data=? WHERE id=? AND order_data IS NULL').bind(data,q.id).run();
 }
 const result=
 await database().prepare(`INSERT OR IGNORE INTO records(id,kind,site,data)
 SELECT q.id,'order',q.site,json_set(q.order_data,'$.createdAt',strftime('%Y-%m-%dT%H:%M:%fZ','now'))
 FROM quote_requests q JOIN email_outbox e ON e.id='quote:'||q.id
 WHERE e.state='accepted' AND q.state='approved' AND q.order_data IS NOT NULL
 AND COALESCE(json_extract(q.order_data,'$.existingOrder'),'')='' AND (?='' OR q.site=?)`).bind(site,site).run();
 return result.meta.changes||0;
}
export async function dispatchMail(limit=20) {
 await createSentQuotes();
 if(!await mailReady('notification')&&!await mailReady('quote'))return {ready:false,accepted:0};
 const db=database(),now=Date.now();
 const rows=await db.prepare("SELECT * FROM email_outbox WHERE state='pending' AND lease<? ORDER BY created LIMIT ?").bind(now,Math.max(1,Math.min(20,limit))).all<any>();
 let accepted=0;
 for(const row of rows.results) {
  // Resend keys expire after 24h: never replay an uncertain old attempt beyond that window.
  if(row.first_attempt && now-row.first_attempt>23*3600000){await db.prepare("UPDATE email_outbox SET state='review' WHERE id=? AND state='pending'").bind(row.id).run();continue;}
  const user=await db.prepare('SELECT email,email_verified,active,role,site,quote_email FROM users WHERE id=?').bind(row.user_id).first<any>();
  const record=await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(row.record_id).first<any>();
  let allowed=user?.active && user.email_verified;
  if(row.kind==='quote_approval') {const q=await db.prepare('SELECT site,state FROM quote_requests WHERE id=?').bind(row.record_id).first<any>();allowed=allowed&&user.email===row.email&&user.role==='manager'&&user.site===q?.site&&q?.state==='pending';}
  else if(row.kind==='quote') {const settings=await db.prepare('SELECT * FROM site_mail_settings WHERE site=?').bind(row.record_id).first<any>();const request=await db.prepare('SELECT state,decided_by FROM quote_requests WHERE id=?').bind(row.id.slice(6)).first<any>();allowed=request?.state==='approved' && user?.active && settings?.confirmed && settings.sender_email===row.reply_to && record?.kind==='site' && (['admin','director'].includes(user.role)||user.site===row.record_id&&(user.role==='manager'||user.role==='technician'&&(!!user.quote_email||!!request.decided_by)));}
  else {
   const data=record?JSON.parse(record.data):null;
   allowed=allowed && user.email===row.email && data && !data.deleted && (record.kind==='routine'||data.status==='planned') && user.role!=='admin' && (user.site===record.site||user.role==='director') && (data.assignment?.mode==='all'||data.assignment?.mode==='named'&&data.assignment.users.includes(row.user_id));
   if(record?.kind==='plan')allowed=allowed&&data.notifyEmail;
   if(row.kind==='routine')allowed=allowed&&row.occurrence>=interventionToday()&&(row.id.includes(':before:')?row.occurrence>interventionToday()&&['before','both'].includes(data.emailReminder):['same','both'].includes(data.emailReminder))&& !await db.prepare("SELECT id FROM records WHERE id=?").bind('routine-done:'+row.record_id+':'+row.occurrence).first();
  }
  if(!allowed){await db.prepare("UPDATE email_outbox SET state='cancelled' WHERE id=? AND state='pending'").bind(row.id).run();continue;}
  const claimed=await db.prepare("UPDATE email_outbox SET lease=?,first_attempt=CASE WHEN first_attempt=0 THEN ? ELSE first_attempt END WHERE id=? AND state='pending' AND lease<? AND (kind NOT IN ('quote','quote_approval') OR EXISTS(SELECT 1 FROM quote_requests q WHERE q.id=CASE WHEN email_outbox.kind='quote' THEN substr(email_outbox.id,7) ELSE email_outbox.record_id END AND q.state=CASE WHEN email_outbox.kind='quote' THEN 'approved' ELSE 'pending' END)) RETURNING id").bind(now+120000,now,row.id,now).all<any>();
  if(!claimed.results.length)continue;
  try {
   if(accepted)await new Promise(resolve=>setTimeout(resolve,600));
   const settings=row.kind==='quote'?await db.prepare('SELECT sender_name FROM site_mail_settings WHERE site=?').bind(row.record_id).first<any>():null;
   const providerId=await sendMail({site:record?.site||user?.site||'',category:row.kind==='quote'?'quote':'notification',senderName:settings?.sender_name,senderEmail:row.reply_to||undefined,to:row.email,subject:row.subject,text:row.body+'\n\n'+await applicationLink(),key:'outbox/'+row.id,replyTo:row.reply_to||undefined});
   await db.prepare("UPDATE email_outbox SET state='accepted',provider_id=?,lease=0 WHERE id=?").bind(providerId,row.id).run();accepted++;
   if(row.kind==='quote')await createSentQuotes();
  }catch {
   const uncertain=await db.prepare("SELECT id FROM mail_deliveries WHERE id=? AND state='sending'").bind('outlook:outbox/'+row.id).first();
   if(uncertain)await db.prepare("UPDATE email_outbox SET state='review',lease=0 WHERE id=?").bind(row.id).run();
   break;
  } // Retry explicit rejections; never automatically replay an uncertain Outlook send.
 }
 return {ready:true,accepted};
}

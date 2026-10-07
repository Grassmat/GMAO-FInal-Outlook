import { normalizeEmail } from '../account/email';
import { database } from '../store';
import { AppError,allowReadSite,allowSite,type User } from '../auth';
import { quoteMailSettings } from './site-settings';
import { applicationLink,mailReady } from './provider';
import { dispatchMail,createSentQuotes } from './planning';
export function canApproveQuote(user:User,site:string){return ['admin','director'].includes(user.role)||user.role==='manager'&&user.site===site;}
export async function listQuoteRequests(user:User,site:string){
 allowReadSite(user,site);
 const created=await createSentQuotes(site);
 const rows=await database().prepare("SELECT q.*,u.name AS author,e.state AS delivery_state,CASE WHEN json_extract(q.order_data,'$.existingOrder')<>'' THEN json_extract(q.order_data,'$.existingOrder') ELSE r.id END AS order_id FROM quote_requests q LEFT JOIN users u ON u.id=q.user_id LEFT JOIN email_outbox e ON e.id='quote:'||q.id LEFT JOIN records r ON r.id=q.id AND r.kind='order' WHERE q.site=? AND q.state<>'deleted' AND (?=1 OR q.user_id=?) ORDER BY q.created DESC LIMIT 100").bind(site,canApproveQuote(user,site)?1:0,user.id).all<any>();
 return {requests:rows.results,created,canApprove:canApproveQuote(user,site)};
}
export async function getQuoteRequest(user:User,id:string){
 const q=await database().prepare('SELECT q.*,u.name AS author FROM quote_requests q LEFT JOIN users u ON u.id=q.user_id WHERE q.id=?').bind(id).first<any>();
 if(!q||q.state==='deleted')throw new AppError('Demande introuvable.',404);
 if(q.user_id!==user.id&&!canApproveQuote(user,q.site))throw new AppError('Cette demande est réservée à son auteur et à l’encadrement du site.',403);
 return {request:q,canApprove:canApproveQuote(user,q.site)};
}
export async function submitQuoteRequest(user:User,input:{id:string;site:string;to:string;subject:string;body:string;details?:any},settings:any){
 const db=database();
 let orderData:string|null=null;
 if(input.details!==undefined){
  const d=input.details;
  if(!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>150||typeof d.reference!=='string'||d.reference.length>200||typeof d.supplier!=='string'||d.supplier.length>200||!Number.isInteger(d.quantity)||d.quantity<1||d.quantity>1000000)throw new AppError('Produit, référence, fournisseur ou quantité invalides.');
  const machine=d.machine||'';
  if(typeof machine!=='string'||machine&&!await db.prepare("SELECT id FROM records WHERE id=? AND kind='machine' AND site=?").bind(machine,input.site).first())throw new AppError('Machine inaccessible.',403);
  if(d.orderId){const existing=await db.prepare("SELECT data FROM records WHERE id=? AND kind='order' AND site=?").bind(d.orderId,input.site).first<any>();if(!existing||JSON.parse(existing.data).deleted)throw new AppError('Devis introuvable.',404);}
  // Existing quotes keep their status and receipt; sending another mail does not duplicate them.
  orderData=JSON.stringify({name:d.name.trim(),reference:d.reference.trim(),supplier:d.supplier.trim()||input.to,quantity:d.quantity,machine,status:'Devis',part:'',revision:1,mailRequest:input.id,recipient:input.to,mailSubject:input.subject,mailBody:input.body,existingOrder:d.orderId||''});
 }
 const previous=await db.prepare('SELECT * FROM quote_requests WHERE id=?').bind(input.id).first<any>();
 if(previous){if(previous.user_id!==user.id||previous.site!==input.site||previous.recipient!==input.to||previous.subject!==input.subject||previous.body!==input.body||previous.sender_email!==settings.sender_email||input.details!==undefined&&previous.order_data!==orderData)throw new AppError('Une demande différente porte déjà cet identifiant.',409);return {ok:true,requiresApproval:previous.state==='pending',message:previous.state==='pending'?'Demande déjà soumise au responsable, en attente de validation.':'Cette demande a déjà été traitée.'};}
 const needsApproval=user.role==='technician'&&!user.quote_email;
 const managers=needsApproval?(await db.prepare("SELECT id,name,email FROM users WHERE role='manager' AND site=? AND active=1 AND email_verified=1 AND email<>''").bind(input.site).all<any>()).results:[];
 // The dashboard remains usable when the responsible person has no verified mailbox yet.
 const now=Date.now(),ops=[db.prepare('INSERT INTO quote_requests(id,user_id,site,recipient,subject,body,sender_email,sender_name,created,state,order_data) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(input.id,user.id,input.site,input.to,input.subject,input.body,settings.sender_email,settings.sender_name,now,needsApproval?'pending':'approved',orderData)];
 if(needsApproval){for(const m of managers){const text='Bonjour '+m.name+',\n\n'+user.name+' demande votre accord pour envoyer ce mail au fournisseur.\n\nExpéditeur / adresse de réponse : '+settings.sender_email+'\nDestinataire : '+input.to+'\nObjet : '+input.subject+'\n\n'+input.body+'\n\nConsultez le message et validez ou refusez depuis la GMAO :\n'+await applicationLink('#quote-approval='+input.id)+'\n\nAucun message n’est envoyé au fournisseur avant votre validation.';ops.push(db.prepare('INSERT INTO email_outbox(id,user_id,record_id,kind,email,subject,body,created) VALUES(?,?,?,?,?,?,?,?)').bind('approval:'+input.id+':'+m.id,m.id,input.id,'quote_approval',m.email,'GMAO — Demande de devis à valider : '+input.subject,text,now));}}
 else ops.push(db.prepare('INSERT INTO email_outbox(id,user_id,record_id,kind,email,subject,body,created,reply_to) VALUES(?,?,?,?,?,?,?,?,?)').bind('quote:'+input.id,user.id,input.site,'quote',input.to,input.subject,input.body,now,settings.sender_email));
 try {await db.batch(ops);}catch(error){const duplicate=await db.prepare('SELECT id FROM quote_requests WHERE id=?').bind(input.id).first();if(duplicate)return submitQuoteRequest(user,input,settings);throw error;}
 await dispatchMail();
 const sent=needsApproval?false:!!await db.prepare("SELECT id FROM email_outbox WHERE id=? AND state='accepted'").bind('quote:'+input.id).first();
 return {ok:true,requiresApproval:needsApproval,message:needsApproval?'Demande soumise au responsable pour validation. Aucun mail n’est envoyé au fournisseur pour le moment.':sent?'Demande envoyée. Le devis est enregistré dans Devis & achats.':'Demande validée et enregistrée pour envoi. Ne la recréez pas.'};
}
export async function decideQuoteRequest(user:User,input:any){
 const {request:q}=await getQuoteRequest(user,input.id);if(!canApproveQuote(user,q.site))throw new AppError('Seul l’encadrement de ce site peut valider la demande.',403);
 if(!['approve','reject'].includes(input.action))throw new AppError('Décision invalide.');
 if(q.state!=='pending'){if(q.state===(input.action==='approve'?'approved':'rejected'))return {ok:true,message:'Cette décision a déjà été enregistrée.'};throw new AppError('Cette demande a déjà été traitée.',409);}
 if(q.revision!==input.revision)throw new AppError('Demande modifiée. Rechargez-la.',409);
 const db=database(),ops=[];
 if(input.action==='approve'){
  if(!await mailReady('quote'))throw new AppError('Le service mail n’est pas encore activé.',503);
  const author=await db.prepare('SELECT id,name,role,site,quote_email,active FROM users WHERE id=?').bind(q.user_id).first<any>();
  if(!author?.active)throw new AppError('L’auteur du message n’a plus de compte actif.');
  const access=await quoteMailSettings(author,q.site);if(!access.canSubmit)throw new AppError('L’auteur n’a plus accès à ce site.');
  if(!access.settings?.confirmed||access.settings.sender_email!==q.sender_email)throw new AppError('L’adresse d’expédition a changé ou n’est plus confirmée. Une nouvelle demande doit être rédigée.');
 }
 const state=input.action==='approve'?'approved':'rejected';
 // Decision CAS and supplier mail are one transaction, so concurrent decisions cannot send twice.
 ops.push(db.prepare("UPDATE quote_requests SET state=CASE WHEN state='pending' AND revision=? THEN ? ELSE NULL END,revision=revision+1,decided_by=?,decided_at=? WHERE id=?").bind(q.revision,state,user.id,Date.now(),q.id));
 if(input.action==='approve')ops.push(db.prepare('INSERT INTO email_outbox(id,user_id,record_id,kind,email,subject,body,created,reply_to) VALUES(?,?,?,?,?,?,?,?,?)').bind('quote:'+q.id,q.user_id,q.site,'quote',q.recipient,q.subject,q.body,Date.now(),q.sender_email));
 try {await db.batch(ops);}catch{throw new AppError('Cette demande vient d’être traitée. Rechargez-la.',409);}
 if(input.action==='approve')await dispatchMail();
 return {ok:true,message:input.action==='approve'?'Demande validée et enregistrée pour envoi au fournisseur.':'Demande refusée. Aucun mail n’est envoyé au fournisseur.'};
}

export async function deleteQuoteRequest(user:User,input:any){
 if(typeof input.id!=='string'||!Number.isInteger(input.revision))throw new AppError('Demande invalide.');
 const db=database(),q=await db.prepare('SELECT * FROM quote_requests WHERE id=?').bind(input.id).first<any>();
 if(!q)throw new AppError('Demande introuvable.',404);
 allowSite(user,q.site);
 if(q.user_id!==user.id&&!canApproveQuote(user,q.site))throw new AppError('Suppression réservée à l’auteur et à l’encadrement du site.',403);
 if(q.state==='deleted')return {ok:true};
 if(q.revision!==input.revision)throw new AppError('La demande a changé. Rechargez-la.',409);
 // Retain the identifier as a tombstone: retries cannot recreate or send a deleted request.
 const now=Date.now();
 try{await db.batch([
  db.prepare(`UPDATE quote_requests SET state=CASE WHEN revision=? AND NOT EXISTS(
   SELECT 1 FROM email_outbox WHERE (id=? OR (kind='quote_approval' AND record_id=?)) AND state='pending' AND lease>?
  ) THEN 'deleted' ELSE NULL END,revision=revision+1 WHERE id=?`).bind(q.revision,'quote:'+q.id,q.id,now,q.id),
  db.prepare("UPDATE email_outbox SET state='cancelled',lease=0 WHERE (id=? OR (kind='quote_approval' AND record_id=?)) AND state='pending'").bind('quote:'+q.id,q.id)
 ]);}catch{throw new AppError('La demande a changé ou son envoi est en cours. Rechargez-la et réessayez.',409);}
 return {ok:true,message:'Demande supprimée. Le devis associé est conservé.'};
}

export async function editQuoteRequest(user:User,input:any){
 const {request:q}=await getQuoteRequest(user,input.id);allowSite(user,q.site);
 if(q.state!=='pending')throw new AppError('Cette demande a déjà été traitée. Modifiez le devis associé après envoi.',409);
 if(input.revision!==q.revision)throw new AppError('La demande a changé. Rechargez-la.',409);
 const to=normalizeEmail(input.to),d=input.details;
 if(typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>200||typeof input.body!=='string'||!input.body.trim()||input.body.length>15000||!d||typeof d.name!=='string'||!d.name.trim()||d.name.length>150||typeof d.reference!=='string'||d.reference.length>200||typeof d.supplier!=='string'||d.supplier.length>200||!Number.isInteger(d.quantity)||d.quantity<1||d.quantity>1000000)throw new AppError('Informations de la demande invalides.');
 const metadata={...(q.order_data?JSON.parse(q.order_data):{machine:'',part:'',status:'Devis',revision:1,existingOrder:'',mailRequest:q.id}),name:d.name.trim(),reference:d.reference.trim(),quantity:d.quantity,supplier:d.supplier.trim()||to,recipient:to,mailSubject:input.subject.trim(),mailBody:input.body};
 const text='Demande de devis à valider, rédigée par '+q.author+' :\n\nDestinataire : '+to+'\nObjet : '+input.subject.trim()+'\n\n'+input.body+'\n\nValidez ou refusez dans la GMAO :\n'+await applicationLink('#quote-approval='+q.id);
 try{await database().batch([
  database().prepare(`UPDATE quote_requests SET body=CASE WHEN state='pending' AND revision=? AND NOT EXISTS(SELECT 1 FROM email_outbox WHERE kind='quote_approval' AND record_id=? AND state='pending' AND lease>?) THEN ? ELSE NULL END,recipient=?,subject=?,order_data=?,revision=revision+1 WHERE id=?`).bind(q.revision,q.id,Date.now(),input.body,to,input.subject.trim(),JSON.stringify(metadata),q.id),
  database().prepare("UPDATE email_outbox SET body=?,subject=? WHERE kind='quote_approval' AND record_id=? AND state='pending'").bind(text,'GMAO — Demande de devis à valider : '+input.subject.trim(),q.id)
 ]);}catch{throw new AppError('La demande a changé ou une notification est en cours. Rechargez et réessayez.',409);}
 return {ok:true,message:'Demande modifiée, toujours en attente de validation.'};
}

import { env } from 'cloudflare:workers';
import { database } from '../store';
import { AppError } from '../auth';
import { readMailConfiguration,anyMailConnection,microsoftRequest,writeSecret } from './configuration';
export async function mailConfiguration(){const config=env as unknown as Record<string,string>;return {key:config.RESEND_API_KEY||'',from:config.MAIL_FROM||'',origin:config.APP_ORIGIN||''};}
export async function mailReady(category:'account'|'notification'|'quote'='account',site?:string,sender?:string){const c=await mailConfiguration();if(site!==undefined){const g=await readMailConfiguration(site,category==='quote'?'quote':'automatic');if(g)return !sender||sender.toLowerCase()===g.sender;if(!c.key)return false;}return /^https:\/\/[^/]+$/.test(c.origin)&&((!!c.key&&!!c.from)||await anyMailConnection(category));}
export async function applicationLink(query=''){const c=await mailConfiguration();if(!/^https:\/\/[^/]+$/.test(c.origin))throw new AppError('Adresse de l’application indisponible.',503);return c.origin+'/'+query;}
function header(value:string){if(/[\r\n]/.test(value))throw new AppError('En-tête mail invalide.');return value;}
const base64=(value:string)=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
export async function sendMail(message:{to:string;subject:string;text:string;key:string;site?:string;replyTo?:string;senderName?:string;senderEmail?:string;category?:'account'|'notification'|'quote'}){
 const outlook=await readMailConfiguration(message.site||'',message.category==='quote'?'quote':'automatic');
 if(outlook){
  if(message.category==='quote'&&message.senderEmail&&message.senderEmail.toLowerCase()!==outlook.sender)throw new AppError('Connectez la boîte Outlook choisie pour les devis de ce site.',503);
  const db=database(),deliveryKey='outlook:'+message.key,previous=await db.prepare('SELECT * FROM mail_deliveries WHERE id=?').bind(deliveryKey).first<any>();
  if(previous?.state==='accepted')return previous.provider_id as string;
  if(previous)throw new AppError('Envoi incertain : vérifiez la boîte Envoyés avant toute reprise manuelle.',503);
  const token=await microsoftRequest('https://login.microsoftonline.com/'+outlook.tenantId+'/oauth2/v2.0/token',new URLSearchParams({client_id:outlook.clientId,client_secret:outlook.clientSecret,refresh_token:outlook.refreshToken,grant_type:'refresh_token',scope:'openid email offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send'}));
  if(typeof token.access_token!=='string')throw new AppError('Reconnectez la boîte Outlook.',503);
  header(message.to);header(message.subject);if(message.replyTo)header(message.replyTo);
  const payload={message:{subject:message.subject,body:{contentType:'Text',content:message.text},toRecipients:[{emailAddress:{address:message.to}}],...(message.replyTo?{replyTo:[{emailAddress:{address:message.replyTo}}]}:{})},saveToSentItems:true};
  // Microsoft can rotate refresh tokens: persist them encrypted before sending.
  if(token.refresh_token&&token.refresh_token!==outlook.refreshToken)await writeSecret(outlook.id,{refreshToken:token.refresh_token,clientId:outlook.clientId,clientSecret:outlook.clientSecret,tenantId:outlook.tenantId,accountId:outlook.accountId},outlook.sender,outlook.revision);
  const claim=await db.prepare("INSERT OR IGNORE INTO mail_deliveries(id,state,created) VALUES(?,'sending',?)").bind(deliveryKey,Date.now()).run();if(!claim.meta.changes)throw new AppError('Envoi déjà en cours ou à vérifier.',503);
  let response:Response;try{response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});}catch{throw new AppError('Envoi Outlook incertain : vérifiez la boîte Envoyés.',503);}
  if(!response.ok){if(response.status<500)await db.prepare("DELETE FROM mail_deliveries WHERE id=? AND state='sending'").bind(deliveryKey).run();throw new AppError('Outlook n’a pas accepté l’envoi. Vérifiez la connexion et le quota.',503);}
  if(response.status!==202)throw new AppError('Réponse Outlook incertaine : vérifiez la boîte Envoyés.',503);
  const receipt='graph-accepted:'+message.key;
  await db.prepare("UPDATE mail_deliveries SET state='accepted',provider_id=? WHERE id=?").bind(receipt,deliveryKey).run();return receipt;
 }
 const c=await mailConfiguration();if(!c.key||!c.from)throw new AppError('Connectez une boîte mail pour activer les envois.',503);
 const configuredAddress=c.from.match(/<([^>]+)>/)?.[1]||c.from,sameDomain=message.senderEmail&&configuredAddress.split('@')[1]?.toLowerCase()===message.senderEmail.split('@')[1]?.toLowerCase();
 const from=message.senderName?message.senderName+' <'+(sameDomain?message.senderEmail:configuredAddress)+'>':c.from;
 let response:Response;try{response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.key,'Content-Type':'application/json','Idempotency-Key':message.key},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text,...(message.replyTo?{reply_to:message.replyTo}:{})}),signal:AbortSignal.timeout(12000)});}catch{throw new AppError('Le service mail est momentanément indisponible.',503);}
 const data:any=await response.json().catch(()=>null);if(!response.ok||typeof data?.id!=='string')throw new AppError('Le service mail n’a pas accepté l’envoi.',503);return data.id as string;
}

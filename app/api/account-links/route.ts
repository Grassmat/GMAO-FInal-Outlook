import { redeemSiteSender } from '../../../lib/mail/site-settings';
import { database } from '../../../lib/store';
import { currentUser, sameOrigin, json, replyError, AppError, digest } from '../../../lib/auth';
import { issueAccountLink, redeemAccountLink, accountRateLimit } from '../../../lib/account/links';
import { mailReady } from '../../../lib/mail/provider';
export async function POST(req:Request) {
 try {
  sameOrigin(req);
  const text=await req.text();if(text.length>4096)throw new AppError('Demande trop volumineuse.');
  const b=JSON.parse(text);
  await accountRateLimit('ip:'+await digest(req.headers.get('cf-connecting-ip')||'unknown'),20);
  if(b.action==='forgot') {
   if(!await mailReady())throw new AppError('La récupération par mail n’est pas encore activée. Contactez votre administrateur.',503);
   if(typeof b.identifier!=='string'||b.identifier.length>254)throw new AppError('Identifiant ou adresse mail obligatoire.');
   const identifier=b.identifier.trim().toLowerCase();await accountRateLimit('recipient:'+await digest(identifier),3);
   const u=await database().prepare('SELECT id FROM users WHERE (username=? OR email=?) AND active=1 AND email_verified=1').bind(identifier,identifier).first<{id:string}>();
   if(u) {try {await issueAccountLink(u.id,'reset');}catch { /* Same reply for existing/missing accounts; no enumeration. */ }}
   return json({ok:true,message:'Si un compte actif possède une adresse mail confirmée, un lien lui sera envoyé.'});
  }
  if(b.action==='verify-send') {
   const u=await currentUser(req,false);if(!u.email)throw new AppError('Enregistrez votre adresse mail d’abord.');
   await accountRateLimit('verify:'+u.id,3);await issueAccountLink(u.id,'verify');return json({ok:true,message:'Le lien de confirmation a été envoyé.'});
  }
  if(b.action==='sender'){await redeemSiteSender(b.token);return json({ok:true});}
  if(b.action==='reset'||b.action==='verify') {await redeemAccountLink(b.token,b.action,b.password);return json({ok:true});}
  throw new AppError('Action inconnue.');
 }catch(e){return replyError(e);}
}

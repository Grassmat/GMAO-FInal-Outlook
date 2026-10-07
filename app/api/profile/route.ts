import { database } from '../../../lib/store';
import { currentUser, sameOrigin, json, replyError, AppError, verifyPassword } from '../../../lib/auth';
import { normalizeEmail } from '../../../lib/account/email';
import { issueAccountLink, accountRateLimit } from '../../../lib/account/links';
import { mailReady } from '../../../lib/mail/provider';
export async function POST(req:Request) {
 try {
  sameOrigin(req); const u=await currentUser(req,false),text=await req.text();
  if(text.length>4096)throw new AppError('Demande trop volumineuse.');
  const b=JSON.parse(text),email=normalizeEmail(b.email),db=database();
  await accountRateLimit('profile:'+u.id,10);
  const row=await db.prepare('SELECT password,email FROM users WHERE id=?').bind(u.id).first<any>();
  if(typeof b.currentPassword!=='string'||!await verifyPassword(b.currentPassword,row.password))throw new AppError('Mot de passe actuel incorrect.');
  if(email===row.email)return json({ok:true});
  if(await db.prepare('SELECT id FROM users WHERE email=? AND id<>?').bind(email,u.id).first())throw new AppError('Cette adresse mail est déjà utilisée.');
  try {await db.batch([db.prepare('UPDATE users SET email=CASE WHEN password=? THEN ? ELSE NULL END,email_verified=0 WHERE id=?').bind(row.password,email,u.id),db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(u.id),db.prepare("UPDATE email_outbox SET state='cancelled' WHERE user_id=? AND state='pending'").bind(u.id)]);}catch{throw new AppError('Le compte a changé ou cette adresse est déjà utilisée. Rechargez la page.',409);}
  let message='Adresse mail enregistrée. L’envoi des mails n’est pas encore activé.';
  if(await mailReady()){try {await issueAccountLink(u.id,'verify');message='Adresse mail enregistrée. Consultez votre boîte mail pour la confirmer.';}catch{message='Adresse enregistrée, mais le mail de confirmation n’a pas pu être envoyé. Vous pourrez le renvoyer depuis votre profil.';}}
  return json({ok:true,message});
 }catch(e){return replyError(e);}
}

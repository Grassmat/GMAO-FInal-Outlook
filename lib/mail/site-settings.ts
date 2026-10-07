import { database } from '../store';
import { AppError,allowReadSite,allowSite,digest,type User } from '../auth';
import { validSite } from '../maintenance/repository';
import { normalizeEmail } from '../account/email';
import { accountRateLimit } from '../account/links';
import { mailReady,applicationLink,sendMail } from './provider';
export async function quoteMailSettings(user:User,site:string){
 allowReadSite(user,site);await validSite(site);
 const settings=await database().prepare('SELECT * FROM site_mail_settings WHERE site=?').bind(site).first<any>();
 const canManage=['admin','director','manager'].includes(user.role)&&(user.role!=='manager'||user.site===site);
 const canSend=(user.role==='admin'||user.role==='director'||user.site===site&&(user.role==='manager'||!!user.quote_email));
 const people=canManage ? (await database().prepare("SELECT id,name,role,quote_email FROM users WHERE active=1 AND site=? AND role<>'admin' ORDER BY name").bind(site).all<any>()).results : [];
 const canSubmit=['admin','director'].includes(user.role)||user.site===site&&['manager','technician'].includes(user.role);
 return {settings,canManage,canSend,canSubmit,people,mailReady:await mailReady('quote',site,settings?.sender_email)};
}
export async function setQuoteMailSettings(user:User,input:any){
 allowSite(user,input.site);await validSite(input.site);
 if(!['admin','director','manager'].includes(user.role))throw new AppError('Seul l’encadrement peut gérer les expéditeurs.',403);
 const db=database();
 if(input.action==='permission'){
  if(typeof input.allowed!=='boolean'||typeof input.userId!=='string')throw new AppError('Autorisation invalide.');
  const person=await db.prepare('SELECT role,site FROM users WHERE id=? AND active=1').bind(input.userId).first<any>();
  if(!person||person.site!==input.site||person.role==='admin')throw new AppError('Utilisateur absent de ce site.',403);
  // Managers/directors already have management access; individual grants concern technicians.
  if(person.role!=='technician')throw new AppError('Cette autorisation concerne les techniciens.');
  await db.prepare("UPDATE users SET quote_email=? WHERE id=? AND site=? AND role='technician'").bind(input.allowed?1:0,input.userId,input.site).run();return {ok:true};
 }
 const email=normalizeEmail(input.email),name=typeof input.name==='string'?input.name.trim():'Maintenance';
 if(!name||name.length>100||/[\r\n<>]/.test(name))throw new AppError('Nom d’expéditeur invalide.');
 const previous=await db.prepare('SELECT * FROM site_mail_settings WHERE site=?').bind(input.site).first<any>();
 if((previous?.revision||0)!==input.revision)throw new AppError('Réglages modifiés. Rechargez-les.',409);
 const known=await db.prepare("SELECT id FROM users WHERE email=? AND email_verified=1 AND active=1 AND (site=? OR role IN ('admin','director'))").bind(email,input.site).first();
 const connected=await db.prepare("SELECT id FROM mail_configuration WHERE sender=? AND id IN (?,?,?)").bind(email,'quote:'+input.site,'automatic:'+input.site,'automatic:global').first();
 const confirmed=connected?1:previous?.sender_email===email?previous.confirmed:known?1:0;
 const saved=await db.prepare('INSERT INTO site_mail_settings(site,sender_email,sender_name,confirmed,revision) VALUES(?,?,?,?,1) ON CONFLICT(site) DO UPDATE SET sender_email=excluded.sender_email,sender_name=excluded.sender_name,confirmed=excluded.confirmed,revision=site_mail_settings.revision+1 WHERE site_mail_settings.revision=?').bind(input.site,email,name,confirmed,input.revision).run();
 if(!saved.meta.changes)throw new AppError('Réglages modifiés. Rechargez-les.',409);
 return {ok:true,message:confirmed?'Adresse d’expédition enregistrée.':'Adresse enregistrée. Confirmez-la par mail avant de l’utiliser.'};
}
export async function confirmSiteSender(user:User,site:string){
 allowSite(user,site);if(!['admin','director','manager'].includes(user.role))throw new AppError('Accès refusé.',403);
 await accountRateLimit('site-sender:'+site,3);
 const row=await database().prepare('SELECT sender_email FROM site_mail_settings WHERE site=?').bind(site).first<any>();
 if(!row?.sender_email)throw new AppError('Enregistrez une adresse d’abord.');
 const account=await database().prepare('SELECT password FROM users WHERE id=?').bind(user.id).first<any>();
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),hash=await digest(token),now=Date.now();
 // No token is generated when mail is unconfigured.
 const link=await applicationLink('#sender='+token);
 await database().prepare('INSERT INTO account_tokens(hash,user_id,purpose,email,fingerprint,expires,created,context) VALUES(?,?,?,?,?,?,?,?)').bind(hash,user.id,'sender',row.sender_email,await digest(account.password),now+86400000,now,site).run();
 try{await sendMail({category:'account',site,to:row.sender_email,subject:'GMAO — Autoriser cette adresse pour les demandes de devis',text:'Le responsable maintenance souhaite utiliser cette adresse pour les demandes de devis de son site. Confirmez avec ce lien :\n\n'+link+'\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.',key:'sender/'+hash});}catch(e){await database().prepare('DELETE FROM account_tokens WHERE hash=?').bind(hash).run();throw e;}
 return {ok:true,message:'Un lien de confirmation a été envoyé à cette adresse.'};
}
export async function redeemSiteSender(token:unknown){
 if(typeof token!=='string'|| !/^[a-f0-9]{64}$/.test(token))throw new AppError('Lien invalide.');
 const db=database(),hash=await digest(token),now=Date.now();
 const row=await db.prepare("SELECT t.*,u.password,u.active,u.role,u.site FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.hash=? AND t.purpose='sender' AND t.expires>?").bind(hash,now).first<any>();
 if(!row?.active||!['admin','director','manager'].includes(row.role)||row.role==='manager'&&row.site!==row.context||row.fingerprint!==await digest(row.password))throw new AppError('Lien invalide ou expiré.');
 const settings=await db.prepare('SELECT sender_email FROM site_mail_settings WHERE site=?').bind(row.context).first<any>();
 if(settings?.sender_email!==row.email)throw new AppError('L’adresse a changé depuis cette demande.');
 try{await db.batch([db.prepare('UPDATE site_mail_settings SET sender_email=CASE WHEN EXISTS(SELECT 1 FROM account_tokens WHERE hash=? AND expires>?) AND sender_email=? THEN sender_email ELSE NULL END,confirmed=1,revision=revision+1 WHERE site=?').bind(hash,now,row.email,row.context),db.prepare('DELETE FROM account_tokens WHERE hash=?').bind(hash)]);}catch{throw new AppError('Lien déjà utilisé ou invalide.');}
}

import { database } from '../store';
import { AppError, digest, passwordHash, validatePassword } from '../auth';
import { mailReady, sendMail, applicationLink } from '../mail/provider';
export async function accountRateLimit(key:string, limit:number) {
  const now=Date.now(), bucket=Math.floor(now/3600000);
  const result=await database().prepare('INSERT INTO login_attempts(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind('account:'+key+':'+bucket,now).all<{count:number}>();
  if(result.results[0].count>limit) throw new AppError('Trop de demandes. Réessayez dans une heure.',429);
}
export async function issueAccountLink(userId:string,purpose:'verify'|'reset') {
  if(!await mailReady()) throw new AppError('L’envoi des mails n’est pas encore activé. Contactez votre administrateur.',503);
  const db=database(), u=await db.prepare('SELECT id,site,email,email_verified,password,active FROM users WHERE id=?').bind(userId).first<any>();
  if(!u?.active || !u.email || (purpose==='reset' && !u.email_verified)) return;
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  const hash=await digest(token),now=Date.now();
  await db.batch([db.prepare('DELETE FROM account_tokens WHERE expires<?').bind(now),db.prepare('INSERT INTO account_tokens(hash,user_id,purpose,email,fingerprint,expires,created) VALUES(?,?,?,?,?,?,?)').bind(hash,u.id,purpose,u.email,await digest(u.password),now+(purpose==='reset'?30:1440)*60000,now)]);
  // URL fragment prevents tokens appearing in request URLs and referrer logs.
  const link=await applicationLink('#'+(purpose==='reset'?'reset':'verify')+'='+token);
  try { await sendMail({category:'account',site:u.site||'',to:u.email,subject:purpose==='reset'?'GMAO — Réinitialiser votre mot de passe':'GMAO — Confirmer votre adresse mail',text:(purpose==='reset'?'Pour choisir un nouveau mot de passe, ouvrez ce lien. Il expire dans 30 minutes.':'Pour confirmer votre adresse mail, ouvrez ce lien. Il expire dans 24 heures.')+'\n\n'+link+'\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message.',key:'account/'+hash}); }
  catch(error) {await db.prepare('DELETE FROM account_tokens WHERE hash=?').bind(hash).run();throw error;}
}
export async function redeemAccountLink(token:unknown,purpose:'verify'|'reset',password?:unknown) {
  if(typeof token!=='string'|| !/^[a-f0-9]{64}$/.test(token)) throw new AppError('Lien invalide ou expiré.');
  if(purpose==='reset') validatePassword(password);
  const db=database(),hash=await digest(token),now=Date.now();
  const row=await db.prepare('SELECT t.*,u.password,u.active,u.email AS current_email FROM account_tokens t JOIN users u ON u.id=t.user_id WHERE t.hash=? AND t.purpose=? AND t.expires>?').bind(hash,purpose,now).first<any>();
  if(!row?.active || row.email!==row.current_email || row.fingerprint!==await digest(row.password)) throw new AppError('Lien invalide ou expiré.');
  // CAS in the same transaction as token consumption; a concurrent replay aborts.
  const exists='EXISTS(SELECT 1 FROM account_tokens WHERE hash=? AND expires>?) AND password=? AND email=? AND active=1';
  const ops=purpose==='reset' ? [db.prepare(`UPDATE users SET password=CASE WHEN ${exists} THEN ? ELSE NULL END,change_password=0 WHERE id=?`).bind(hash,now,row.password,row.email,await passwordHash(password as string),row.user_id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(row.user_id)] : [db.prepare(`UPDATE users SET email=CASE WHEN ${exists} THEN email ELSE NULL END,email_verified=1 WHERE id=?`).bind(hash,now,row.password,row.email,row.user_id)];
  ops.push(db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(row.user_id));
  try {await db.batch(ops);} catch {throw new AppError('Lien invalide ou déjà utilisé.');}
}

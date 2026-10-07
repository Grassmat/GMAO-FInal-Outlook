import { normalizeEmail } from '../../../lib/account/email';
import { issueAccountLink } from '../../../lib/account/links';
import { mailReady } from '../../../lib/mail/provider';

import { database } from '../../../lib/store';
import { AppError, sameOrigin, replyError, json, currentUser, seedAdmin, verifyPassword, newSession, clearCookie, cookieToken, digest, passwordHash, validatePassword } from '../../../lib/auth';
export async function GET(req: Request) {
  try {
    return json({ user: await currentUser(req, false), mailReady: await mailReady() });
  }
  catch (e) {
    return replyError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const b: any = await req.json();
    const db = database();
    if (b.action === 'logout') {
      const token = cookieToken(req);
      if (token)
        await db.prepare('DELETE FROM sessions WHERE token=?').bind(await digest(token)).run();
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': clearCookie, 'Cache-Control': 'no-store' } });
    }
    if (b.action === 'password') {
      const u = await currentUser(req, false);
      validatePassword(b.password);
      const stored: any = await db.prepare('SELECT password FROM users WHERE id=?').bind(u.id).first();
      if (typeof b.currentPassword !== 'string' || !await verifyPassword(b.currentPassword, stored.password))
        throw new AppError('Mot de passe actuel incorrect.');
      const email = u.email || (u.test_account && !b.email ? '' : normalizeEmail(b.email));
      if (email && await db.prepare('SELECT id FROM users WHERE email=? AND id<>?').bind(email,u.id).first()) throw new AppError('Cette adresse mail est déjà utilisée.');
      await db.batch([db.prepare('UPDATE users SET password=CASE WHEN password=? THEN ? ELSE NULL END,change_password=0,email=? WHERE id=?').bind(stored.password,await passwordHash(b.password),email,u.id), db.prepare('DELETE FROM sessions WHERE user_id=?').bind(u.id),db.prepare('DELETE FROM account_tokens WHERE user_id=?').bind(u.id)]);
      if(email && !u.email && await mailReady()) {try {await issueAccountLink(u.id,'verify');}catch{ /* Verification can be resent from the profile. */ }}
      return Response.json({ ok: true }, { headers: { 'Set-Cookie': await newSession(u.id), 'Cache-Control': 'no-store' } });
    }
    await seedAdmin();
    if (typeof b.username !== 'string' || typeof b.password !== 'string' || b.password.length > 128)
      throw new AppError('Identifiant ou mot de passe incorrect.', 401);
    const name = b.username.trim().toLowerCase().slice(0, 64);
    const now = Date.now();
    const bucket = Math.floor(now / 900000);
    const keys = [`name:${name}:${bucket}`, `ip:${req.headers.get('cf-connecting-ip') || 'unknown'}:${bucket}`];
    const attempts = await db.batch(keys.map(key => db.prepare('INSERT INTO login_attempts(key,count,window) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key, now)));
    if ((attempts[0].results[0] as any).count > 10 || (attempts[1].results[0] as any).count > 60)
      throw new AppError('Trop de tentatives. Réessayez dans 15 minutes.', 429);
    const u: any = await db.prepare('SELECT * FROM users WHERE username=?').bind(name).first();
    const dummy: any = await db.prepare("SELECT password FROM users WHERE id='initial-admin'").first();
    const correct = await verifyPassword(b.password, u?.password || dummy.password);
    if (!u || !u.active || !correct)
      throw new AppError('Identifiant ou mot de passe incorrect.', 401);
    await db.batch([db.prepare('DELETE FROM login_attempts WHERE key=?').bind(keys[0]), db.prepare('DELETE FROM login_attempts WHERE window<?').bind(now - 1800000)]);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': await newSession(u.id), 'Cache-Control': 'no-store' } });
  }
  catch (e) {
    return replyError(e);
  }
}

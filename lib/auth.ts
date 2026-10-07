
import { env } from 'cloudflare:workers';
import { database } from './store';
export type User = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'director' | 'manager' | 'technician';
  site: string | null;
  active: number;
  change_password: number;
  test_account?: number;
  quote_email?: number;
  email?: string;
  email_verified?: number;
  avatar_key?: string;
  avatar_version?: number;
};
export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
export const roles = ['admin', 'director', 'manager', 'technician'];
export function globalAccess(u: User) {
  return u.role === 'admin' || u.role === 'director';
}
export function globalReadAccess(u: User) { return globalAccess(u) || u.role === 'manager'; }
export function allowReadSite(u: User, site: string) {
  if (!globalReadAccess(u) && u.site !== site) throw new AppError('Accès refusé à cette blanchisserie.', 403);
}
export function allowSite(u: User, site: string) {
  if (!globalAccess(u) && u.site !== site)
    throw new AppError('Accès refusé à cette blanchisserie.', 403);
}
export function sameOrigin(req: Request) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    throw new AppError('Origine refusée.', 403);
}
export function replyError(e: unknown) {
  if (!(e instanceof AppError))
    console.error(e);
  return Response.json({ error: e instanceof AppError ? e.message : 'Service indisponible. Réessayez.' }, { status: e instanceof AppError ? e.status : 503, headers: { 'Cache-Control': 'no-store' } });
}
export function json(d: unknown) {
  return Response.json(d, { headers: { 'Cache-Control': 'no-store' } });
}
const hex = (v: ArrayBuffer | Uint8Array) => Array.from(v instanceof Uint8Array ? v : new Uint8Array(v)).map(x => x.toString(16).padStart(2, '0')).join('');
export async function digest(s: string) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}
export async function passwordHash(password: string, salt = hex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$100000$${salt}$${hex(bits)}`;
}
export async function verifyPassword(value: string, hash: string) {
  const parts = hash.split('$');
  if (parts.length !== 4)
    return false;
  const actual = await passwordHash(value, parts[2]);
  let different = actual.length ^ hash.length;
  for (let i = 0; i < actual.length; i++)
    different |= actual.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return different === 0;
}
export function validatePassword(s: unknown): asserts s is string {
  if (typeof s !== 'string' || s.length < 6 || s.length > 128)
    throw new AppError('Le mot de passe doit contenir entre 6 et 128 caractères.');
}
export function cookieToken(req: Request) {
  return req.headers.get('cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('__Host-gmao_session='))?.slice('__Host-gmao_session='.length) || '';
}
export async function currentUser(req: Request, requirePasswordChange = true): Promise<User> {
  const token = cookieToken(req);
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new AppError('Connectez-vous pour continuer.', 401);
  const u = await database().prepare('SELECT u.id,u.username,u.name,u.role,u.site,u.active,u.change_password,u.test_account,u.email,u.email_verified,u.avatar_key,u.avatar_version,u.quote_email FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1').bind(await digest(token), Date.now()).first<User>();
  if (!u)
    throw new AppError('Votre session a expiré. Reconnectez-vous.', 401);
  if (requirePasswordChange && u.change_password)
    throw new AppError('Choisissez votre mot de passe pour continuer.', 428);
  if (requirePasswordChange && !u.email && !u.test_account)
    throw new AppError('Renseignez votre adresse mail pour continuer.', 428);
  return u;
}
export async function seedAdmin() {
  const secret = (env as unknown as Record<string, string>).BOOTSTRAP_ADMIN_HASH;
  if (!secret)
    throw new AppError('La connexion administrateur est indisponible.', 503);
  await database().prepare('INSERT OR IGNORE INTO users(id,username,name,role,site,password,active,change_password) VALUES(?,?,?,?,?,?,1,1)').bind('initial-admin', 'admin', 'Administrateur', 'admin', null, secret).run();
}
export async function newSession(id: string) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const db = database();
  await db.batch([db.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()), db.prepare('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)').bind(await digest(token), id, Date.now() + 12 * 3600 * 1000)]);
  return `__Host-gmao_session=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=43200`;
}
export const clearCookie = '__Host-gmao_session=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';


import { database } from '../../../lib/store';
import { currentUser, AppError, roles, sameOrigin, replyError, json, validatePassword, passwordHash } from '../../../lib/auth';
async function administrator(req: Request) {
  const u = await currentUser(req);
  if (!['admin', 'director'].includes(u.role))
    throw new AppError('Seuls un administrateur et le Directeur technique peuvent gérer les utilisateurs.', 403);
  return u;
}
export async function GET(req: Request) {
  try {
    const actor=await currentUser(req);
    if(!['admin','director','manager'].includes(actor.role))throw new AppError('Accès refusé.',403);
    const fields='id,username,name,role,site,active,change_password,test_account,planning_create,quote_email';
    const rows = actor.role==='manager'
      ? await database().prepare('SELECT '+fields+" FROM users WHERE site=? AND role='technician' ORDER BY name").bind(actor.site).all()
      : await database().prepare('SELECT '+fields+' FROM users ORDER BY name').all();
    return json({ users: rows.results });
  }
  catch (e) {
    return replyError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const actor = await administrator(req);
    const b: any = await req.json();
    if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 100 || typeof b.username !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(b.username.trim().toLowerCase()) || !roles.includes(b.role))
      throw new AppError('Nom, identifiant (3–40 caractères) et rôle valides obligatoires.');
    const db = database();
    const site = ['admin', 'director'].includes(b.role) ? null : b.site;
    if (site !== null && !await db.prepare("SELECT id FROM records WHERE kind='site' AND id=?").bind(site || '').first())
      throw new AppError('Choisissez une blanchisserie existante.');
    if (!['admin', 'director'].includes(b.role) && !site)
      throw new AppError('Le site est obligatoire.');
    const id = b.id || crypto.randomUUID();
    const target = b.id ? await db.prepare('SELECT id,role,site,test_account,planning_create,quote_email FROM users WHERE id=?').bind(id).first<{id:string;role:string;site:string;test_account:number;planning_create:number;quote_email:number}>() : null;
    if (b.id && !target) throw new AppError('Utilisateur introuvable.', 404);
    if (actor.role === 'director' && (b.role === 'admin' || target?.role === 'admin'))
      throw new AppError('Les comptes et le rôle Admin sont réservés à un administrateur.', 403);
    if (actor.id === id && (b.role !== actor.role || b.active === false))
      throw new AppError('Vous ne pouvez pas retirer votre propre accès de gestion.');
    const duplicate = await db.prepare('SELECT id FROM users WHERE username=? AND id<>?').bind(b.username.trim().toLowerCase(), id).first();
    if (duplicate)
      throw new AppError('Cet identifiant est déjà utilisé.');
    if (!b.id)
      validatePassword(b.password);
    if (b.password)
      validatePassword(b.password);
    if(b.test_account!==undefined && ![true,false,0,1].includes(b.test_account))throw new AppError('Option de compte test invalide.');
    const testAccount=b.test_account===undefined?(target?.test_account||0):(b.test_account?1:0);
    for(const key of ['planning_create','quote_email'])if(b[key]!==undefined&&![true,false,0,1].includes(b[key]))throw new AppError('Permission invalide.');
    const permission=(key:'planning_create'|'quote_email')=>b.role!=='technician'?0:b[key]!==undefined?(b[key]?1:0):target?.site===site&&target?.role===b.role?(target?.[key]||0):0;
    const ops = [];
    if (!b.id) {
      ops.push(db.prepare('INSERT INTO users(id,username,name,role,site,password,active,change_password,test_account) VALUES(?,?,?,?,?,?,?,1,?)').bind(id, b.username.trim().toLowerCase(), b.name.trim(), b.role, site, await passwordHash(b.password), b.active === false ? 0 : 1,testAccount));
    }
    else {
      ops.push(db.prepare("UPDATE users SET quote_email=?,planning_create=?,username=?,name=?,role=?,site=?,active=?,test_account=? WHERE id=? AND (?='admin' OR role<>'admin')").bind(permission('quote_email'),permission('planning_create'),b.username.trim().toLowerCase(), b.name.trim(), b.role, site, b.active === false ? 0 : 1,testAccount, id, actor.role));
      if (b.password)
        ops.push(db.prepare("UPDATE users SET password=?,change_password=1 WHERE id=? AND (?='admin' OR role<>'admin')").bind(await passwordHash(b.password), id, actor.role));
      ops.push(db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id));
    }
    if(!b.id)ops.push(db.prepare('UPDATE users SET quote_email=?,planning_create=? WHERE id=?').bind(permission('quote_email'),permission('planning_create'),id));
    await db.batch(ops);
    return json({ ok: true });
  }
  catch (e) {
    return replyError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const actor = await administrator(req);
    const body: any = await req.json();
    const id = body.id;
    if (typeof id !== 'string' || !id) throw new AppError('Utilisateur obligatoire.');
    const db = database();
    const target = await db.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first<{id:string;role:string}>();
    if (!target) throw new AppError('Utilisateur introuvable.', 404);
    if (actor.role === 'director' && target.role === 'admin')
      throw new AppError('Les comptes Admin sont réservés à un administrateur.', 403);
    if (actor.id === id) throw new AppError('Vous ne pouvez pas supprimer votre propre compte.');
    // Keep intervention authors and stock history; remove only the account and its sessions.
    await db.batch([db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),
      db.prepare("DELETE FROM users WHERE id=? AND (?='admin' OR role<>'admin')").bind(id, actor.role)]);
    return json({ok:true});
  } catch(e) { return replyError(e); }
}


export async function PATCH(req:Request){
 try{
  sameOrigin(req);const actor=await currentUser(req);
  if(!['admin','director','manager'].includes(actor.role))throw new AppError('Accès refusé.',403);
  const b:any=await req.json();
  if(typeof b.id!=='string'||![true,false,0,1].includes(b.planning_create)||![true,false,0,1].includes(b.quote_email))throw new AppError('Permissions invalides.');
  const db=database(),target=await db.prepare('SELECT role,site FROM users WHERE id=?').bind(b.id).first<any>();
  if(!target||target.role!=='technician'||actor.role==='manager'&&target.site!==actor.site)throw new AppError('Technicien inaccessible.',403);
  const result=await db.prepare("UPDATE users SET planning_create=?,quote_email=? WHERE id=? AND role='technician' AND site IS ?").bind(b.planning_create?1:0,b.quote_email?1:0,b.id,target.site).run();
  if(!result.meta.changes)throw new AppError('Compte modifié. Rechargez la liste.',409);
  return json({ok:true});
 }catch(e){return replyError(e);}
}

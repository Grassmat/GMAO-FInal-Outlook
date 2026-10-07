
import { machineStates } from '../interventions/machine-state';
import { database } from '../store';
import { allowSite, globalReadAccess, globalAccess, AppError, type User } from '../auth';
import { initializeMaintenance, validSite, validMachine, saveSite } from './repository';
import { stockMovementStatement, stockError } from './stock';
import { savePart, changePart, activePart } from './parts';
import { saveOrder, deleteOrder } from './orders';
export async function readMaintenance(u: User) {
  const db = database();
  await initializeMaintenance();
  const records = await (globalReadAccess(u) ? db.prepare('SELECT rowid AS creationOrder,* FROM records') : db.prepare("SELECT rowid AS creationOrder,* FROM records WHERE (kind<>'site' AND site=?) OR (kind='site' AND id=?)").bind(u.site, u.site)).all();
  const movements = await (globalReadAccess(u) ? db.prepare('SELECT * FROM movements ORDER BY created DESC') : db.prepare('SELECT * FROM movements WHERE site=? ORDER BY created DESC').bind(u.site)).all();
  const sites = records.results.filter((r: any) => r.kind === 'site').map((r: any) => ({ id: r.id, name: JSON.parse(r.data).name }));
  const states = await machineStates(u);
  return { user: u, sites, records: records.results.map((r: any) => ({ ...r, ...JSON.parse(r.data), creationOrder:r.creationOrder, ...(r.kind === 'machine' ? states.get(r.id) || {serviceState:'unknown'} : {}) })), movements: movements.results, reports: null };
}
export async function writeMaintenance(u: User, b: any) {
  const db = database();
  if(b.action==='machine-state'){
    if(typeof b.id!=='string'||!['running','stopped'].includes(b.serviceState))throw new AppError('État de machine invalide.');
    const machine=await db.prepare("SELECT site,data FROM records WHERE id=? AND kind='machine'").bind(b.id).first<any>();
    if(!machine)throw new AppError('Machine introuvable.',404);
    allowSite(u,machine.site);
    const current=(await machineStates(u)).get(b.id),expected=(current?.stateReport||'')+':'+(current?.stateRevision||0);
    if((current?.serviceState||'unknown')!==b.expectedState||expected!==b.expectedReport)throw new AppError('L’état a changé. Actualisez la fiche.',409);
    const next={...JSON.parse(machine.data),manualServiceState:b.serviceState,manualServiceAnchor:expected,manualServiceAt:new Date().toISOString(),manualServiceBy:u.id};
    const result=await db.prepare("UPDATE records SET data=? WHERE id=? AND kind='machine' AND data=?").bind(JSON.stringify(next),b.id,machine.data).run();
    if(!result.meta.changes)throw new AppError('La machine a changé. Actualisez la fiche.',409);
    return;
  }
  if (b.action === 'delete-order') {
    await deleteOrder(u, b.id || '');
    return;
  }
  if (b.action === 'delete-part' || b.action === 'minimum') {
    await changePart(u, b);
    return;
  }
  if (b.kind === 'part' && b.action !== 'movement') {
    await savePart(u, b);
    return;
  }
  if (b.kind === 'order') {
    await saveOrder(u, b);
    return;
  }
  if (b.kind === 'site') {
    if (typeof b.name !== 'string')
      throw new AppError('Nom du site obligatoire.');
    await saveSite(u, b);
    return;
  }
  if (b.action === 'movement') {
    if (!Number.isSafeInteger(b.quantity) || b.quantity === 0 || Math.abs(b.quantity) > 1000000 || typeof b.reason !== 'string' || !b.reason.trim())
      throw new AppError('Quantité et motif obligatoires.');
    const movementId = typeof b.clientId === 'string' && /^[a-f0-9-]{36}$/.test(b.clientId) ? 'manual:' + b.clientId : crypto.randomUUID();
    const previous = await db.prepare('SELECT site,part,quantity FROM movements WHERE id=?').bind(movementId).first<{ site: string; part: string; quantity: number }>();
    if (previous) {
      allowSite(u, previous.site);
      if (previous.part !== b.part || previous.quantity !== b.quantity) throw new AppError('Cette entrée ou sortie a déjà été enregistrée avec une autre quantité.', 409);
      return;
    }
    const part = await activePart(b.part || '');
    allowSite(u, part.site);
    if (b.machine)
      await validMachine(b.machine, part.site);
    try {
      await db.batch([stockMovementStatement({ id: movementId, part: part.id, site: part.site,
        quantity: b.quantity, machine: b.machine || null, reason: b.reason.trim().slice(0, 1000),
        actor: u.name, created: new Date().toISOString() })]);
    } catch (error) {
      const saved = await db.prepare('SELECT site,part,quantity FROM movements WHERE id=?').bind(movementId).first<{ site: string; part: string; quantity: number }>();
      if (saved?.site === part.site && saved.part === part.id && saved.quantity === b.quantity) return;
      const issue = stockError(error);
      if (issue) throw issue;
      throw error;
    }
  }
  else {
    if (b.kind !== 'machine' || typeof b.name !== 'string' || !b.name.trim() || typeof b.site !== 'string')
      throw new AppError('Nom et site obligatoires.');
    allowSite(u, b.site);
    await validSite(b.site);
    const id = b.id || crypto.randomUUID();
    const existing: any = b.id ? await db.prepare('SELECT kind,site FROM records WHERE id=?').bind(id).first() : null;
    if (b.id && !existing)
      throw new AppError('Élément introuvable.', 404);
    if (existing) {
      if (existing.kind !== b.kind)
        throw new AppError('Type incompatible.');
      if (existing.kind !== 'site') {
        allowSite(u, existing.site);
        if (existing.site !== b.site)
          throw new AppError('Le changement de site n’est pas autorisé.');
      }
    }
    const data = { name: b.name.trim().slice(0, 150), reference: String(b.reference || '').slice(0, 200), location: String(b.location || '').slice(0, 200), minimum: Math.max(0, Math.min(1000000, Number(b.minimum) || 0)), machines: b.machines || [], archived: !!b.archived, status: ['Devis', 'Commandé', 'Reçu', 'Annulé'].includes(b.status) ? b.status : 'Devis', supplier: String(b.supplier || '').slice(0, 200), url: '', machine: b.machine || '' };
    await db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=json_patch(records.data,excluded.data) WHERE records.site=excluded.site AND records.kind=excluded.kind').bind(id, b.kind, b.site, JSON.stringify(data)).run();
  }
}

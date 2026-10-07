import { database } from '../store';
import { AppError, allowSite, type User } from '../auth';
import { validSite, validMachine } from './repository';
import { stockMovementStatement } from './stock';

export function stockQuantity(value: unknown, allowZero = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1) || (value as number) > 1000000)
    throw new AppError(allowZero ? 'La quantité doit être un entier entre 0 et 1 000 000.' : 'La quantité doit être un entier entre 1 et 1 000 000.');
  return value as number;
}
export async function activePart(id: string, site?: string) {
  const row = await database().prepare("SELECT id,site,data FROM records WHERE id=? AND kind='part'").bind(id).first<{ id: string; site: string; data: string }>();
  if (!row || (site && row.site !== site) || JSON.parse(row.data).deleted)
    throw new AppError('Référence absente ou supprimée du magasin de ce site.', 403);
  return { ...row, values: JSON.parse(row.data) };
}
export async function changePart(user: User, input: any) {
  if (input.action === 'delete-part') {
    if (user.role !== 'admin') throw new AppError('Seul l’admin peut supprimer une référence du magasin.', 403);
    const row = await database().prepare("SELECT site FROM records WHERE id=? AND kind='part'").bind(input.id || '').first<{ site: string }>();
    if (!row) throw new AppError('Référence introuvable.', 404);
    allowSite(user, row.site);
    await database().prepare("UPDATE records SET data=json_set(data,'$.deleted',1) WHERE id=?").bind(input.id).run();
    return;
  }
  const row = await activePart(input.id || input.part || '');
  allowSite(user, row.site);
  if (input.action === 'minimum') {
    const minimum = stockQuantity(input.minimum, true);
    // A JSON path update preserves simultaneous changes to the designation or location.
    await database().prepare("UPDATE records SET data=json_set(data,'$.minimum',?) WHERE id=? AND COALESCE(json_extract(data,'$.deleted'),0)=0").bind(minimum, row.id).run();
  }
}
export async function savePart(user: User, input: any) {
  if (typeof input.site !== 'string' || typeof input.name !== 'string' || !input.name.trim()) throw new AppError('Nom et site obligatoires.');
  allowSite(user, input.site);
  await validSite(input.site);
  const db = database();
  const id = input.id || (typeof input.clientId === 'string' && /^[a-f0-9-]{36}$/.test(input.clientId) ? input.clientId : crypto.randomUUID());
  if (!input.id) {
    const retry = await db.prepare('SELECT kind,site FROM records WHERE id=?').bind(id).first<{ kind: string; site: string }>();
    if (retry) {
      if (retry.kind !== 'part' || retry.site !== input.site) throw new AppError('Identifiant déjà utilisé.', 409);
      return;
    }
  }
  const existing = input.id ? await activePart(id, input.site) : null;
  if (!Array.isArray(input.machines) || input.machines.length > 500) throw new AppError('Machines compatibles invalides.');
  for (const machine of input.machines) await validMachine(machine, input.site);
  const quantity = existing ? 0 : stockQuantity(input.quantity ?? 0, true);
  const data = { ...existing?.values, name: input.name.trim().slice(0, 150), reference: String(input.reference || '').slice(0, 200),
    location: String(input.location || '').slice(0, 200), supplier: String(input.supplier || '').slice(0, 200),
    machines: [...new Set(input.machines)], minimum: existing ? existing.values.minimum || 0 : 0, deleted: false };
  const write = existing ? db.prepare(`UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END
    WHERE id=? AND kind='part' AND site=?`).bind(existing.data, JSON.stringify(data), id, input.site)
    : db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id, 'part', input.site, JSON.stringify(data));
  const ops = [write];
  if (quantity) ops.push(stockMovementStatement({ id: 'initial:' + id, part: id, site: input.site, quantity,
    machine: null, reason: 'Stock initial', actor: user.name, created: new Date().toISOString() }));
  try { await db.batch(ops); }
  catch (error) {
    if (String(error).includes('NOT NULL constraint failed: records.data')) throw new AppError('La référence a changé. Rechargez sa fiche avant de modifier.', 409);
    if (!existing && String(error).includes('UNIQUE constraint failed: records.id')) {
      const retry = await db.prepare('SELECT kind,site FROM records WHERE id=?').bind(id).first<{ kind: string; site: string }>();
      if (retry?.kind === 'part' && retry.site === input.site) return;
    }
    throw error;
  }
}

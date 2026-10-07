
import { database } from '../store';
import { AppError, globalAccess, type User } from '../auth';
// A new installation contains no sites or machines.
export async function initializeMaintenance() {}
export async function validSite(site: string) {
  if (!await database().prepare("SELECT id FROM records WHERE id=? AND kind='site'").bind(site).first())
    throw new AppError('Blanchisserie introuvable.', 404);
}
export async function validMachine(id: string, site: string) {
  const m = await database().prepare("SELECT site FROM records WHERE id=? AND kind='machine'").bind(id).first<{
    site: string;
  }>();
  if (!m || m.site !== site)
    throw new AppError('Cette machine n’appartient pas à cette blanchisserie.', 403);
}
export async function saveSite(user: User, input: {
  id?: string;
  name: string;
}) {
  if (!globalAccess(user))
    throw new AppError('Vous ne pouvez pas modifier les blanchisseries.', 403);
  const name = input.name.trim();
  if (!name || name.length > 150)
    throw new AppError('Le nom du site doit contenir entre 1 et 150 caractères.');
  const db = database();
  if (input.id) {
    const current = await db.prepare("SELECT data FROM records WHERE id=? AND kind='site'").bind(input.id).first<{
      data: string;
    }>();
    if (!current)
      throw new AppError('Blanchisserie introuvable.', 404);
    await db.prepare("UPDATE records SET data=? WHERE id=? AND kind='site'").bind(JSON.stringify({ ...JSON.parse(current.data), name }), input.id).run();
  }
  else {
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id, 'site', id, JSON.stringify({ name })).run();
  }
}

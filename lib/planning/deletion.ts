import { database } from '../store';
import { AppError, allowSite, type User } from '../auth';
import { canManagePlanning } from './permissions';
export async function deletePlanning(user: User, input: any) {
    if (!canManagePlanning(user)) throw new AppError('Seuls l’admin, le directeur technique ou le responsable du site peuvent supprimer une tâche planifiée.', 403);
    if (!['plan', 'routine'].includes(input.kind) || typeof input.id !== 'string') throw new AppError('Tâche invalide.');
    const db = database(), row = await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(input.id).first<{kind:string;site:string;data:string}>();
    if (!row || row.kind !== input.kind) throw new AppError('Tâche introuvable.', 404);
    allowSite(user, row.site);
    const previous = JSON.parse(row.data);
    if (previous.deleted) return { id: input.id };
    if (previous.revision !== input.revision) throw new AppError('La tâche a changé. Rechargez le planning avant de la supprimer.', 409);
    const data = { ...previous, deleted: true, deletedBy: user.id, deletedAt: new Date().toISOString(), revision: previous.revision + 1 };
    try { await db.prepare('UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=?').bind(row.data, JSON.stringify(data), input.id).run(); }
    catch (error) { if (String(error).includes('records.data')) throw new AppError('La tâche a changé pendant la suppression. Rechargez le planning.', 409); throw error; }
    return { id: input.id };
}

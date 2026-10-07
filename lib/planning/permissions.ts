import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';
import { validSite } from '../maintenance/repository';
export function canManagePlanning(user: User) { return ['admin', 'director', 'manager'].includes(user.role); }
export async function planningAccess(user: User, site: string) {
    allowReadSite(user, site); await validSite(site);
    const canManage = canManagePlanning(user) && (user.role !== 'manager' || user.site === site);
    const technician = canManage ? null : await database().prepare("SELECT planning_create FROM users WHERE id=? AND site=? AND role='technician' AND active=1").bind(user.id, site).first<{ planning_create: number }>();
    return { canCreate: canManage || technician?.planning_create === 1, canManage };
}
export async function requirePlanningWrite(user: User, site: string) {
    if (!(await planningAccess(user, site)).canCreate) throw new AppError('Vous n’avez pas l’autorisation de créer ou modifier les tâches du planning.', 403);
}
export async function setPlanningPermission(user: User, input: any) {
    allowSite(user, input.site); await validSite(input.site);
    if (!canManagePlanning(user)) throw new AppError('Seuls l’admin, le directeur technique ou le responsable du site peuvent attribuer ce droit.', 403);
    if (typeof input.user !== 'string' || typeof input.enabled !== 'boolean') throw new AppError('Autorisation invalide.');
    const result = await database().prepare("UPDATE users SET planning_create=? WHERE id=? AND site=? AND role='technician' AND active=1").bind(input.enabled ? 1 : 0, input.user, input.site).run();
    if (!result.meta.changes) throw new AppError('Technicien actif introuvable sur ce site.', 403);
    return { ok: true };
}

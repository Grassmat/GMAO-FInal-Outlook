import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';
import { validSite } from '../maintenance/repository';
import type { Assignment, Teammate } from './types';
export async function listTeammates(user: User, site: string): Promise<Teammate[]> {
    allowReadSite(user, site);
    await validSite(site);
    const rows = await database().prepare("SELECT id,name,role,planning_create FROM users WHERE active=1 AND role<>'admin' AND (site=? OR role='director') ORDER BY name,id").bind(site).all<Teammate>();
    return rows.results;
}
export async function validateAssignment(user: User, site: string, input: any): Promise<Assignment> {
    if (input == null) return { mode: 'any', users: [] };
    if (!['any', 'all', 'named'].includes(input.mode)) throw new AppError('Affectation invalide.');
    if (input.mode !== 'named') return { mode: input.mode, users: [] };
    if (!Array.isArray(input.users) || !input.users.length || input.users.length > 100 || input.users.some((id: unknown) => typeof id !== 'string')) throw new AppError('Choisissez au moins une personne.');
    const users = [...new Set<string>(input.users)], eligible = await listTeammates(user, site);
    if (users.some(id => !eligible.some(person => person.id === id))) throw new AppError('Une personne sélectionnée ne peut pas être affectée à ce site.');
    return { mode: 'named', users };
}

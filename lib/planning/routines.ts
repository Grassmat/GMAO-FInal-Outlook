import { requirePlanningWrite } from './permissions';
import { validatePlanningMachines } from './machines';
import { validateAssignment } from './assignments';
import { routineOccurs, isPlanningDate } from './routines-client';
import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';
import { validSite, validMachine } from '../maintenance/repository';
import { interventionToday } from '../interventions/types';
import type { Routine, RoutineDone } from './types';
export async function listRoutines(user: User, site: string) {
    allowReadSite(user, site);
    await validSite(site);
    const rows = await database().prepare("SELECT id,data,kind FROM records WHERE site=? AND kind IN ('routine','routine_done')").bind(site).all<{
        id: string;
        data: string;
        kind: string;
    }>();
    return { routines: rows.results.filter(r => r.kind === 'routine' && !JSON.parse(r.data).deleted).map(r => ({ ...JSON.parse(r.data), id: r.id, site }) as Routine), done: rows.results.filter(r => r.kind === 'routine_done').map(r => JSON.parse(r.data) as RoutineDone) };
}
export async function saveRoutine(user: User, input: any) {
    await requirePlanningWrite(user, input?.site);
    allowSite(user, input.site);
    await validSite(input.site);
    if (input.instructions != null && (typeof input.instructions !== 'string' || input.instructions.length > 10000)) throw new AppError('Précisions invalides ou trop longues.');
    const machines = await validatePlanningMachines(input);
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 150 || !['daily', 'weekly', 'monthly'].includes(input.frequency) || !isPlanningDate(input.start))
        throw new AppError('Tâche, début et fréquence valides obligatoires.');
    const id = input.id || input.clientId, db = database();
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
        throw new AppError('Identifiant invalide.');
    const row = await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(id).first<{
        kind: string;
        site: string;
        data: string;
    }>();
    if (row && (row.kind !== 'routine' || row.site !== input.site))
        throw new AppError('Tâche inaccessible.', 403);
    if (row && !input.id)
        return { id };
    if (input.id && !row)
        throw new AppError('Tâche introuvable.', 404);
    const previous = row ? JSON.parse(row.data) : null;
    if (previous && (previous.deleted || previous.revision !== input.revision))
        throw new AppError('Tâche modifiée. Rechargez le calendrier.', 409);
    if(input.emailReminder != null && !['none','same','before','both'].includes(input.emailReminder)) throw new AppError('Rappel mail invalide.');
    const data = { emailReminder: input.emailReminder || 'none', assignment: await validateAssignment(user, input.site, input.assignment), name: input.name.trim(), instructions: input.instructions || '', machine: machines[0], machines, start: input.start, frequency: input.frequency, revision: (previous?.revision || 0) + 1 };
    try {
        if (row)
            await db.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=? AND kind='routine'").bind(row.data, JSON.stringify(data), id).run();
        else
            await db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id, 'routine', input.site, JSON.stringify(data)).run();
    }
    catch (error) {
        if (String(error).includes('records.data'))
            throw new AppError('Tâche modifiée pendant la saisie.', 409);
        throw error;
    }
    return { id };
}
export async function completeRoutine(user: User, input: any) {
    const db = database(), row = await db.prepare("SELECT site,data FROM records WHERE id=? AND kind='routine'").bind(input.id).first<{
        site: string;
        data: string;
    }>();
    if (!row)
        throw new AppError('Tâche introuvable.', 404);
    allowSite(user, row.site);
    if (JSON.parse(row.data).deleted) throw new AppError('Cette tâche a été supprimée.', 409);
    if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > interventionToday() || !routineOccurs({ ...JSON.parse(row.data), id: input.id, site: row.site }, input.date))
        throw new AppError('Occurrence invalide ou future.');
    const id = 'routine-done:' + input.id + ':' + input.date;
    try {
        await db.prepare("INSERT INTO records(id,kind,site,data) VALUES(?,?,?,CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND data=?) THEN ? ELSE NULL END) ON CONFLICT(id) DO NOTHING").bind(id, 'routine_done', row.site, input.id, row.data, JSON.stringify({ routine: input.id, date: input.date, actor: user.name, completedAt: new Date().toISOString() })).run();
    } catch (error) { if (String(error).includes('records.data')) throw new AppError('La tâche a changé ou a été supprimée. Rechargez le calendrier.', 409); throw error; }
    return { id };
}

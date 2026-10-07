import { requirePlanningWrite } from './permissions';
import { validatePlanningMachines } from './machines';
import { validateAssignment } from './assignments';
import { isPlanningDate, planningMachines } from './routines-client';
import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';
import { validSite, validMachine } from '../maintenance/repository';
import type { Plan, PlanView, Requirement } from './types';
export async function listPlans(user: User, site: string): Promise<PlanView[]> {
    allowReadSite(user, site);
    await validSite(site);
    const db = database();
    const rows = await db.prepare('SELECT id,kind,data FROM records WHERE site=?').bind(site).all<{
        id: string;
        kind: string;
        data: string;
    }>();
    const records = new Map(rows.results.map(r => [r.id, { ...JSON.parse(r.data), kind: r.kind }]));
    const quantities = await db.prepare('SELECT part,SUM(quantity) AS quantity FROM movements WHERE site=? GROUP BY part').bind(site).all<{
        part: string;
        quantity: number;
    }>();
    const stock = new Map(quantities.results.map(r => [r.part, r.quantity]));
    return rows.results.filter(r => r.kind === 'plan' && !JSON.parse(r.data).deleted).map(row => {
        const plan = { ...JSON.parse(row.data), id: row.id, site } as Plan;
        const blockers: string[] = [], needed = new Map<string, number>();
        const machines = planningMachines(plan);
        const machineName = machines.map(id => {
            const machine = records.get(id);
            if (!machine || machine.kind !== 'machine' || machine.archived) blockers.push('Machine absente ou archivée : ' + (machine?.name || id));
            return machine?.name || 'Machine introuvable';
        }).join(', ');
        if (plan.equipment && !plan.equipmentReady)
            blockers.push('Équipement indisponible : ' + plan.equipment);
        for (const line of plan.requirements) {
            let part = line.part;
            if (line.order) {
                const order = records.get(line.order);
                if (!order || order.kind !== 'order' || order.deleted) {
                    blockers.push('Devis supprimé ou introuvable');
                    continue;
                }
                if (order.status !== 'Reçu')
                    blockers.push(order.name + ' : ' + (order.status === 'Commandé' ? 'commande non reçue' : order.status === 'Annulé' ? 'commande annulée' : 'pièce non commandée / non reçue'));
                part = order.receivedPart || order.part || null;
            }
            if (!part) {
                blockers.push('Référence de stock attendue après réception');
                continue;
            }
            needed.set(part, (needed.get(part) || 0) + line.quantity);
        }
        const parts: PlanView['parts'] = [];
        for (const [part, quantity] of needed) {
            const ref = records.get(part);
            if (!ref || ref.kind !== 'part' || ref.deleted) {
                blockers.push('Référence supprimée ou absente du magasin');
                continue;
            }
            parts.push({ part, name: ref.name, reference: ref.reference || '', quantity });
            const available = stock.get(part) || 0;
            if (available < quantity)
                blockers.push(ref.name + ' : ' + available + ' en stock / ' + quantity + ' requis');
        }
        return { ...plan, machines, machineName, ready: blockers.length === 0, blockers: [...new Set(blockers)], parts };
    }).sort((a, b) => (a.date || '9999-99-99').localeCompare(b.date || '9999-99-99') || a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt));
}
export async function savePlan(user: User, input: any) {
    await requirePlanningWrite(user, input?.site);
    if (!input || typeof input.site !== 'string')
        throw new AppError('Site obligatoire.');
    allowSite(user, input.site);
    await validSite(input.site);
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 150 || typeof input.work !== 'string' || input.work.length > 10000)
        throw new AppError('Titre et travaux prévus invalides.');
    if ((input.date != null && input.date !== '' && !isPlanningDate(input.date)) || (input.time != null && typeof input.time !== 'string') || (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)))
        throw new AppError('Date et heure invalides.');
    if (input.instructions != null && (typeof input.instructions !== 'string' || input.instructions.length > 10000)) throw new AppError('Précisions invalides ou trop longues.');
    const machines = await validatePlanningMachines(input);
    const db = database(), id = input.id || input.clientId;
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id))
        throw new AppError('Identifiant invalide.');
    const old = await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(id).first<{
        kind: string;
        site: string;
        data: string;
    }>();
    if (old && (old.kind !== 'plan' || old.site !== input.site))
        throw new AppError('Planning inaccessible.', 403);
    if (old && !input.id)
        return { id };
    if (input.id && !old)
        throw new AppError('Intervention planifiée introuvable.', 404);
    const previous = old ? JSON.parse(old.data) : null;
    if (previous && (previous.status !== 'planned' || previous.deleted || input.revision !== previous.revision))
        throw new AppError('Cette intervention a changé ou est déjà réalisée. Rechargez le planning.', 409);
    if (!Array.isArray(input.requirements) || input.requirements.length > 50)
        throw new AppError('Pièces requises invalides.');
    const requirements: Requirement[] = [];
    for (const line of input.requirements) {
        if (!line || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000000 || !!line.part === !!line.order)
            throw new AppError('Choisissez une pièce ou un devis et une quantité positive.');
        const linked = await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(line.part || line.order).first<{
            kind: string;
            site: string;
            data: string;
        }>();
        if (!linked || linked.site !== input.site || linked.kind !== (line.part ? 'part' : 'order') || JSON.parse(linked.data).deleted)
            throw new AppError('Pièce ou devis absent de ce site.', 403);
        requirements.push({ part: line.part || null, order: line.order || null, quantity: line.quantity });
    }
    if(input.notifyEmail != null && typeof input.notifyEmail !== 'boolean') throw new AppError('Option mail invalide.');
    const data: Plan = { notifyEmail: input.notifyEmail === true, assignment: await validateAssignment(user, input.site, input.assignment), name: input.name.trim(), machine: machines[0], machines, date: input.date || '', instructions: input.instructions || '', time: input.time || '', work: input.work, requirements, equipment: String(input.equipment || '').trim().slice(0, 1000), equipmentReady: input.equipmentReady === true, status: 'planned', revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || new Date().toISOString(), id, site: input.site };
    try {
        if (old)
            await db.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=? AND kind='plan'").bind(old.data, JSON.stringify(data), id).run();
        else
            await db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id, 'plan', input.site, JSON.stringify(data)).run();
    }
    catch (error) {
        if (String(error).includes('records.data'))
            throw new AppError('Planning modifié pendant la saisie. Rechargez-le.', 409);
        throw error;
    }
    return { id };
}
export async function planCompletion(user: User, input: any, reportId: string, machines: string[]) {
    if (!input.planId)
        return null;
    const db = database(), row = await db.prepare("SELECT site,data FROM records WHERE id=? AND kind='plan'").bind(input.planId).first<{
        site: string;
        data: string;
    }>();
    if (!row)
        throw new AppError('Intervention planifiée introuvable.', 404);
    allowSite(user, row.site);
    if (row.site !== input.site)
        throw new AppError('Le planning appartient à un autre site.', 403);
    const plan = JSON.parse(row.data) as Plan;
    if ((plan as Plan & {
        deleted?: boolean;
    }).deleted || plan.status !== 'planned' || input.planRevision !== plan.revision)
        throw new AppError('L’intervention planifiée a changé ou a déjà été réalisée. Rechargez le planning.', 409);
    if (!Array.isArray(machines) || !planningMachines(plan).every(id => machines.includes(id)))
        throw new AppError('Le rapport doit concerner toutes les machines de l’intervention planifiée.');
    const data = { ...plan, status: 'done', reportId, completedAt: new Date().toISOString(), revision: plan.revision + 1 };
    return db.prepare("UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END WHERE id=? AND kind='plan'").bind(row.data, JSON.stringify(data), input.planId);
}

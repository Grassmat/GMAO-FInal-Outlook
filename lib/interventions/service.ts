
import { env } from 'cloudflare:workers';
import { database } from '../store';
import { AppError, allowReadSite, allowSite, globalReadAccess, globalAccess, type User } from '../auth';
import { initializeMaintenance, validSite } from '../maintenance/repository';
import { hiddenPreventiveQuestion, initialQuestions, questionTypes, interventionDuration, currentInterventions, interventionToday, type Question, type Answer, type FormDefinition } from './types';
import { validatePartUsage } from './parts';
import { stockMovementStatement, stockError } from '../maintenance/stock';
import { canDeleteIntervention, canEditIntervention } from './deletion';
import { planCompletion } from '../planning/service';
import { prepareOrder } from '../maintenance/orders';
export async function initializeInterventions() {
 await database().prepare('INSERT OR IGNORE INTO intervention_form(id,version,questions) VALUES(?,1,?)').bind('global',JSON.stringify(initialQuestions)).run();
}
export async function getInterventionForm(site?:string) {
  await initializeInterventions();
  const form = await database().prepare("SELECT version,questions FROM intervention_form WHERE id='global'").first<{ version: number; questions: string }>();
  const questions:Question[]=JSON.parse(form!.questions);
  if(site){
    const people=await database().prepare("SELECT name FROM users WHERE active=1 AND role<>'admin' AND (site=? OR role='director') ORDER BY name").bind(site).all<{name:string}>();
    for(const q of questions)if(q.id==='technicians'&&q.type==='multiselect'&&!q.options.length)q.options=[...new Set(people.results.map(p=>p.name))];
  }
  return {version:form!.version,questions} as FormDefinition
}
export async function updateInterventionForm(user: User, input: any) {
  if (!globalAccess(user)) throw new AppError('Seuls l’admin et le Directeur technique peuvent modifier le formulaire.', 403);
  await initializeInterventions();
  if (!Number.isSafeInteger(input.version) || !Array.isArray(input.questions) || input.questions.length > 50) throw new AppError('Formulaire invalide (50 questions maximum).');
  const ids = new Set<string>();
  const questions: Question[] = [];
  for (const q of input.questions) {
    if (!q || typeof q.id !== 'string' || ! /^[a-zA-Z0-9_-]{1,80}$/.test(q.id) || ids.has(q.id) || typeof q.label !== 'string' || !q.label.trim() || q.label.length > 200 || !questionTypes.includes(q.type)) throw new AppError('Chaque question doit avoir un identifiant unique, un libellé et un type valides.');
    const options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
    if (options.length > 100 || options.some((o: string) => o.length > 200) || new Set(options).size !== options.length) throw new AppError('Choix invalides ou en double.');
    if (['select', 'multiselect'].includes(q.type) && !options.length) throw new AppError('Ajoutez au moins un choix pour « ' + q.label + ' ».');
    ids.add(q.id);
    questions.push({ id: q.id, label: q.label.trim(), type: q.type, required: !!q.required, options });
  }
  const result = await database().prepare("UPDATE intervention_form SET questions=?,version=version+1 WHERE id='global' AND version=?").bind(JSON.stringify(questions), input.version).run();
  if (!result.meta.changes) throw new AppError('Le formulaire a été modifié par quelqu’un d’autre. Rechargez-le avant de continuer.', 409);
}
export async function listInterventions(user: User, site: string, machine?: string | null) {
  const all = site === 'all';
  if (all) {
    if (!globalReadAccess(user)) throw new AppError('Accès intersites refusé.', 403)
  } else allowReadSite(user, site);
  await initializeInterventions();
  if (!all) await validSite(site);
  if (machine) {
    const row = await database().prepare("SELECT site FROM records WHERE id=? AND kind='machine'").bind(machine).first<{ site: string }>();
    if (!row || row.site !== site) throw new AppError('Machine introuvable pour ce site.', 404)
  }
  const db = database();
  const rows = await (machine ? db.prepare('SELECT i.* FROM interventions i WHERE i.site=? AND i.deleted=0 AND EXISTS(SELECT 1 FROM intervention_machines m WHERE m.intervention=i.id AND m.machine=?) ORDER BY i.date DESC,i.created DESC').bind(site, machine) : all ? db.prepare('SELECT * FROM interventions WHERE deleted=0 ORDER BY date DESC,created DESC') : db.prepare('SELECT * FROM interventions WHERE site=? AND deleted=0 ORDER BY date DESC,created DESC').bind(site)).all<any>();
  const links = await (all ? db.prepare('SELECT m.intervention,m.machine AS id,m.name FROM intervention_machines m JOIN interventions i ON i.id=m.intervention') : db.prepare('SELECT m.intervention,m.machine AS id,m.name FROM intervention_machines m JOIN interventions i ON i.id=m.intervention WHERE i.site=?').bind(site)).all<any>();
  const files = await (all ? db.prepare('SELECT f.intervention,f.id,f.field,f.name,f.mime FROM intervention_files f JOIN interventions i ON i.id=f.intervention') : db.prepare('SELECT f.intervention,f.id,f.field,f.name,f.mime FROM intervention_files f JOIN interventions i ON i.id=f.intervention WHERE i.site=?').bind(site)).all<any>();
  const parts = await (all ? db.prepare('SELECT p.intervention,p.part,p.name,p.reference,p.quantity FROM intervention_parts p JOIN interventions i ON i.id=p.intervention') : db.prepare('SELECT p.intervention,p.part,p.name,p.reference,p.quantity FROM intervention_parts p JOIN interventions i ON i.id=p.intervention WHERE i.site=?').bind(site)).all<any>();
  const machines = await (all ? db.prepare("SELECT id,site,data FROM records WHERE kind='machine'") : db.prepare("SELECT id,site,data FROM records WHERE kind='machine' AND site=?").bind(site)).all<any>();
  const currentNames = new Map(machines.results.map(m => [m.id, JSON.parse(m.data).name]));
  const siteRows=await db.prepare("SELECT id,data FROM records WHERE kind='site'").all<any>();
  const siteNames=new Map(siteRows.results.map(s=>[s.id,JSON.parse(s.data).name]));
  const byReport = <T extends { intervention: string }>(entries: T[]) => {
    const grouped = new Map<string, T[]>();
    for (const entry of entries) {
      const list = grouped.get(entry.intervention) || [];
      list.push(entry);
      grouped.set(entry.intervention, list);
    }
    return grouped;
  };
  const reportMachines = byReport(links.results), reportFiles = byReport(files.results), reportParts = byReport(parts.results);
  const orders = await (all ? db.prepare("SELECT id,site,data FROM records WHERE kind='order' AND COALESCE(json_extract(data,'$.deleted'),0)=0") : db.prepare("SELECT id,site,data FROM records WHERE kind='order' AND site=? AND COALESCE(json_extract(data,'$.deleted'),0)=0").bind(site)).all<any>();
  return { orders: orders.results.map(r => ({ ...JSON.parse(r.data), id:r.id, site:r.site })), interventions: rows.results.map(r => ({ ...r, canDelete:canDeleteIntervention(user,r), canEdit:canEditIntervention(user,r), siteName:siteNames.get(r.site)||r.site, answers: JSON.parse(r.answers), questions: JSON.parse(r.questions), machines: (reportMachines.get(r.id) || []).map(m => ({ id: m.id, name: currentNames.get(m.id) || m.name })), files: reportFiles.get(r.id) || [], parts: reportParts.get(r.id) || [] })).sort(currentInterventions), machines: machines.results.map(m => ({ id: m.id, site: m.site, ...JSON.parse(m.data) })) };
}
function validateAnswers(questions: Question[], input: any, uploads: Map<string, File[]>, retained: Record<string, string[]> = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Réponses invalides.');
  const answers: Record<string, Answer> = {};
  for (const q of questions) {
    if (q.type === 'photos') {
      if (q.required && !hiddenPreventiveQuestion(q, input) && !(uploads.get(q.id)?.length) && !retained[q.id]?.length) throw new AppError('Ajoutez une photo pour « ' + q.label + ' ».');
      answers[q.id] = retained[q.id] || [];
      continue
    }
    const value = input[q.id] ?? (q.type === 'multiselect' ? [] : '');
    if (q.type === 'multiselect') {
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !q.options.includes(v))) throw new AppError('Choix invalide pour « ' + q.label + ' ».');
      answers[q.id] = [...new Set(value)] as string[]
    }
    else {
      if (typeof value !== 'string' || value.length > 10000) throw new AppError('Réponse invalide pour « ' + q.label + ' ».');
      const text = value.trim();
      if (text) {
        if (q.type === 'select' && !q.options.includes(text)) throw new AppError('Choix invalide pour « ' + q.label + ' ».');
        if (q.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text)) throw new AppError('Date invalide.');
        if (q.type === 'time' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new AppError('Heure invalide.');
        if (q.type === 'number' && !Number.isFinite(Number(text))) throw new AppError('Nombre invalide.')
      }
      answers[q.id] = text
    }
    if (q.required && !hiddenPreventiveQuestion(q, input) && (!answers[q.id] || (Array.isArray(answers[q.id]) && answers[q.id].length === 0))) throw new AppError('Répondez à « ' + q.label + ' ».');
  }
  return answers;
}
export async function createIntervention(user: User, input: any, uploads: Map<string, File[]>) {
  return writeIntervention(user, input, uploads, false);
}
export async function updateIntervention(user: User, input: any, uploads: Map<string, File[]>) {
  return writeIntervention(user, input, uploads, true);
}
async function writeIntervention(user: User, input: any, uploads: Map<string, File[]>, editing: boolean) {
  if (!input || typeof input.site !== 'string') throw new AppError('Site obligatoire.');
  allowSite(user, input.site);
  await validSite(input.site);
  const db = database();
  const id = typeof input.id === 'string' && /^[a-f0-9-]{36}$/.test(input.id) ? input.id : crypto.randomUUID();
  const existing = await db.prepare('SELECT * FROM interventions WHERE id=?').bind(id).first<any>();
  if (editing) {
    if (!existing) throw new AppError('Rapport introuvable.',404);
    allowSite(user, existing.site);
    if (existing.deleted) throw new AppError('Ce rapport a été supprimé.',409);
    if (!canEditIntervention(user,existing)) throw new AppError('Vous pouvez modifier uniquement vos rapports. L’admin et le Directeur technique peuvent tous les modifier.',403);
    if (existing.site !== input.site) throw new AppError('Le site du rapport ne peut pas être changé.',400);
    if (typeof input.editToken !== 'string' || !/^[a-f0-9-]{36}$/.test(input.editToken)) throw new AppError('Identifiant de modification invalide.');
    if (existing.last_edit === input.editToken) return { id, ...(input.newOrder ? {orderId:existing?.waiting_order || input.newOrder.clientId} : {}) };
    if (input.revision !== existing.revision) throw new AppError('Ce rapport a changé. Fermez puis rouvrez-le avant de le modifier.',409);
  }
  if (existing && !editing) {
    if (existing.deleted) throw new AppError('Ce rapport a été supprimé. Créez une nouvelle intervention.', 409);
    if (existing.site !== input.site) throw new AppError('Cet identifiant de rapport est déjà utilisé sur un autre site.', 409);
    return { id, ...(input.newOrder ? {orderId:existing?.waiting_order || input.newOrder.clientId} : {}) };
  }
  if(editing && input.planId) throw new AppError('Le lien au planning se fait lors de la création du rapport.');
  const completion = !editing ? await planCompletion(user,input,id,input.machines || []) : null;
  const definition = editing ? { version: input.version, questions: JSON.parse(existing.questions) as Question[] } : await getInterventionForm(input.site);
  if (!editing && input.version !== definition.version) throw new AppError('Le formulaire a changé. Rechargez-le avant d’enregistrer.', 409);
  if (!Array.isArray(input.machines) || !input.machines.length || input.machines.length > 100 || new Set(input.machines).size !== input.machines.length) throw new AppError('Choisissez au moins une machine.');
  const linked = [];
  for (const id of input.machines) {
    if (typeof id !== 'string') throw new AppError('Machine invalide.');
    const m = await db.prepare("SELECT id,site,data FROM records WHERE id=? AND kind='machine'").bind(id).first<any>();
    if (!m || m.site !== input.site || (JSON.parse(m.data).archived && !(editing && (await db.prepare('SELECT id FROM intervention_machines WHERE intervention=? AND machine=?').bind(input.id, m.id).first())))) throw new AppError('Cette machine est absente ou archivée sur ce site.', 403);
    linked.push({ id: m.id, name: JSON.parse(m.data).name })
  }
  for (const field of uploads.keys()) if (!definition.questions.some(q => q.id === field && q.type === 'photos')) throw new AppError('La question photo n’existe plus.');
  const oldFiles = editing ? (await db.prepare('SELECT * FROM intervention_files WHERE intervention=?').bind(id).all<any>()).results : [];
  const keepFiles = editing ? input.keepFiles : [];
  if (!Array.isArray(keepFiles) || keepFiles.some((file: unknown) => typeof file !== 'string' || !oldFiles.some(f => f.id === file)) || new Set(keepFiles).size !== keepFiles.length) throw new AppError('Photos conservées invalides.');
  const keptFiles = oldFiles.filter(f => keepFiles.includes(f.id));
  const retained: Record<string,string[]> = {};
  for (const file of keptFiles) (retained[file.field] ||= []).push(file.id);
  if (editing) {
    const oldAnswers = JSON.parse(existing.answers);
    for (const q of definition.questions.filter(q => q.type === 'photos')) {
      const links = Array.isArray(input.answers?.[q.id]) ? input.answers[q.id].filter((v: unknown) => typeof v === 'string' && v.startsWith('https://')) : [];
      if (links.some((v: string) => !Array.isArray(oldAnswers[q.id]) || !oldAnswers[q.id].includes(v))) throw new AppError('Lien photo historique invalide.');
      (retained[q.id] ||= []).push(...links);
    }
  }
  const answers = validateAnswers(definition.questions, input.answers, uploads, retained);
  const oldParts = editing ? (await db.prepare('SELECT part,name,reference,quantity FROM intervention_parts WHERE intervention=?').bind(id).all<any>()).results : [];
  const parts = await validatePartUsage(input.site, input.parts, oldParts);
  const machineService = input.machineService ?? (['Oui','Non'].includes(String(answers.service)) ? answers.service : null);
  if (machineService !== null && !['Oui','Non'].includes(machineService)) throw new AppError('État de remise en service invalide.');
  if (machineService && definition.questions.some(q => q.id === 'service' && q.type === 'select' && q.options.includes(machineService))) answers.service = machineService;
  const waitingNote = machineService === 'Non' ? String(input.waitingNote || '').trim() : '';
  if (waitingNote.length > 1000) throw new AppError('Précision d’attente limitée à 1 000 caractères.');
  let waitingOrder = machineService === 'Non' && input.waitingOrder ? String(input.waitingOrder) : null;
  let preparedOrder: Awaited<ReturnType<typeof prepareOrder>> | null = null;
  if (input.newOrder) {
    if (machineService !== 'Non' || !waitingNote || waitingOrder) throw new AppError('Pour créer un devis, indiquez une machine hors service, la pièce attendue et aucun autre devis associé.');
    if (typeof input.newOrder.clientId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.newOrder.clientId) || input.newOrder.id) throw new AppError('Identifiant du nouveau devis invalide.');
    preparedOrder = await prepareOrder(user,{...input.newOrder,site:input.site,intervention:undefined,
      machine:linked.length === 1 ? linked[0].id : input.newOrder.machine || ''});
    waitingOrder = preparedOrder.id;
  }
  if (waitingOrder && !preparedOrder) {
    const order = await db.prepare("SELECT site,data FROM records WHERE id=? AND kind='order'").bind(waitingOrder).first<any>();
    if (!order || order.site !== input.site || JSON.parse(order.data).deleted) throw new AppError('Devis ou commande absent de ce site.',403);
    if (!waitingNote) throw new AppError('Précisez la pièce attendue.');
  }
  const allFiles = [...uploads.values()].flat();
  if (allFiles.length + keptFiles.length > 5) throw new AppError('Cinq photos maximum par intervention.');
  const metadata = [];
  for (const [field, files] of uploads) for (const file of files) {
    if (file.size === 0 || file.size > 5 * 1024 * 1024) throw new AppError('Chaque photo doit faire moins de 5 Mo.');
    const h = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const jpeg = h[0] === 255 && h[1] === 216 && h[2] === 255;
    const png = h[0] === 137 && h[1] === 80 && h[2] === 78 && h[3] === 71 && h[4] === 13 && h[5] === 10 && h[6] === 26 && h[7] === 10;
    const webp = new TextDecoder().decode(h.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(h.slice(8, 12)) === 'WEBP';
    const mime = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : '';
    if (!mime) throw new AppError('Photos acceptées : JPEG, PNG ou WebP.');
    metadata.push({ id: crypto.randomUUID(), field, file, mime, name: file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 200) });
  }
  if (metadata.length && !env.BUCKET) throw new AppError('Le stockage des photos est indisponible.', 503);
  const stored: string[] = [];
  try {
    for (const file of metadata) {
      const key = `intervention-photos/${id}/${file.id}`;
      await env.BUCKET!.put(key, await file.file.arrayBuffer(), { httpMetadata: { contentType: file.mime } });
      stored.push(key);
      (answers[file.field] as string[]).push(file.id)
    }
    const date = definition.questions.some(q => q.id === 'date' && q.type === 'date') && typeof answers.date === 'string' && answers.date ? answers.date : editing ? existing.date : new Date().toISOString().slice(0, 10);
    const duration = definition.questions.some(q => q.id === 'start' && q.type === 'time') && definition.questions.some(q => q.id === 'end' && q.type === 'time') ? interventionDuration(answers) : null;
    if (date > interventionToday()) throw new AppError('La date du rapport est dans le futur. Corrigez-la pour enregistrer une intervention réalisée.');
    const created = new Date().toISOString();
    const ops = editing ? [db.prepare(`UPDATE interventions SET answers=CASE WHEN revision=? AND deleted=0 THEN ? ELSE NULL END,
      date=?,duration=?,machine_service=?,waiting_note=?,waiting_order=?,revision=revision+1,last_edit=?,updated_by=?,updated_at=? WHERE id=?`)
      .bind(input.revision, JSON.stringify(answers), date, duration, machineService, waitingNote, waitingOrder, input.editToken, user.id, created, id),
      db.prepare('DELETE FROM intervention_machines WHERE intervention=?').bind(id),
      db.prepare('DELETE FROM intervention_parts WHERE intervention=?').bind(id),
      db.prepare('DELETE FROM intervention_files WHERE intervention=?').bind(id)]
      : [db.prepare('INSERT INTO interventions(id,site,created,actor,date,duration,answers,questions,source,author_id,machine_service,waiting_note,waiting_order) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(id, input.site, created, user.name, date, duration, JSON.stringify(answers), JSON.stringify(definition.questions), 'GMAO', user.id, machineService, waitingNote, waitingOrder)];
    if (preparedOrder) ops.push(...preparedOrder.ops);
    if (completion) ops.push(completion);
    for (const file of keptFiles) ops.push(db.prepare('INSERT INTO intervention_files(id,intervention,field,site,name,mime,object_key) VALUES(?,?,?,?,?,?,?)')
      .bind(file.id,id,file.field,input.site,file.name,file.mime,file.object_key));
    for (const machine of linked) ops.push(db.prepare('INSERT INTO intervention_machines(id,intervention,machine,name) VALUES(?,?,?,?)').bind(id + ':' + machine.id, id, machine.id, machine.name));
    for (const file of metadata) ops.push(db.prepare('INSERT INTO intervention_files(id,intervention,field,site,name,mime,object_key) VALUES(?,?,?,?,?,?,?)').bind(file.id, id, file.field, input.site, file.name, file.mime, `intervention-photos/${id}/${file.id}`));
    for (const [index, part] of parts.entries()) {
      ops.push(db.prepare('INSERT INTO intervention_parts(id,intervention,part,name,reference,quantity) VALUES(?,?,?,?,?,?)')
        .bind(id + ':' + index, id, part.part, part.name, part.reference, part.quantity));
      if (part.part && !editing) ops.push(stockMovementStatement({ id: id + ':part:' + part.part, part: part.part,
        site: input.site, quantity: -part.quantity, machine: linked.length === 1 ? linked[0].id : null,
        reason: 'Intervention · ' + linked.map(m => m.name).join(', ').slice(0, 900),
        actor: user.name, created, intervention: id }));
    }
    if (editing) {
      const used = (await db.prepare('SELECT part,-SUM(quantity) AS used FROM movements WHERE intervention=? GROUP BY part').bind(id).all<{part:string;used:number}>()).results;
      const old = new Map(used.map(p => [p.part,p.used]));
      const desired = new Map(parts.filter(p => p.part).map(p => [p.part!,p.quantity]));
      for (const part of new Set([...old.keys(),...desired.keys()])) {
        const delta = (old.get(part) || 0) - (desired.get(part) || 0);
        if (!delta) continue;
        const movement = { id:id + ':edit:' + input.editToken + ':' + part, part, site:input.site, quantity:delta,
          machine:linked.length === 1 ? linked[0].id : null, reason:'Modification du rapport · ' + id, actor:user.name,created,intervention:id };
        if (delta < 0) ops.push(stockMovementStatement(movement));
        else ops.push(db.prepare('INSERT INTO movements(id,part,site,quantity,machine,reason,actor,created,intervention) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(movement.id,part,input.site,delta,movement.machine,movement.reason,user.name,created,id));
      }
    }
    // Guard against a concurrent form edit while files were uploading.
    const current = await db.prepare("SELECT version FROM intervention_form WHERE id='global'").first<{ version: number }>();
    if (!editing && current?.version !== definition.version) throw new AppError('Le formulaire a changé pendant l’envoi. Rechargez-le.', 409);
    await db.batch(ops);
    // Removed photos can no longer be served; clean their objects only after the edit commits.
    if (editing && env.BUCKET) for (const file of oldFiles.filter(f => !keepFiles.includes(f.id))) {
      try { await env.BUCKET.delete(file.object_key); } catch (cleanup) { console.error('Removed photo cleanup failed',cleanup); }
    }
    return { id, ...(input.newOrder ? {orderId:preparedOrder!.id} : {}) };
  } catch (error) {
    for (const key of stored) try {
      await env.BUCKET!.delete(key)
    } catch (cleanup) {
      console.error('Photo cleanup failed', cleanup)
    }
    if (editing) {
      const saved = await db.prepare('SELECT deleted,last_edit,waiting_order FROM interventions WHERE id=?').bind(id).first<any>();
      if (!saved?.deleted && saved?.last_edit === input.editToken) return { id, ...(input.newOrder ? {orderId:saved.waiting_order || input.newOrder.clientId} : {}) };
      if (String(error).includes('NOT NULL constraint failed: interventions.answers')) throw new AppError('Ce rapport a été modifié ou supprimé pendant votre saisie. Fermez puis rouvrez-le.',409);
    }
    if(completion && String(error).includes('NOT NULL constraint failed: records.data')) throw new AppError('Le planning a changé ou a été réalisé pendant votre saisie. Rechargez-le ; aucun rapport ni prélèvement n’a été enregistré.',409);
    const issue = stockError(error);
    if (issue) throw issue;
    // A concurrent retry may have committed this report while this request was uploading.
    const committed = await db.prepare('SELECT site,deleted,waiting_order FROM interventions WHERE id=?').bind(id).first<{ site: string; deleted: number; waiting_order: string | null }>();
    if (committed?.deleted) throw new AppError('Ce rapport a été supprimé. Créez une nouvelle intervention.', 409);
    if (!editing && committed && committed.site === input.site) return { id, ...(input.newOrder ? {orderId:committed.waiting_order} : {}) };
    throw error
  }
}
export async function interventionFile(user: User, intervention: string, id: string) {
  const file = await database().prepare('SELECT f.*,i.site AS report_site FROM intervention_files f JOIN interventions i ON i.id=f.intervention WHERE f.id=? AND f.intervention=? AND i.deleted=0').bind(id, intervention).first<any>();
  if (!file) throw new AppError('Photo introuvable.', 404);
  allowReadSite(user, file.report_site);
  if (!env.BUCKET) throw new AppError('Stockage indisponible.', 503);
  const object = await env.BUCKET.get(file.object_key);
  if (!object) throw new AppError('Photo indisponible.', 503);
  return { file, object };
}

export async function interventionStockUpdates(id: string) {
  const rows = await database().prepare(`SELECT m.part,json_extract(r.data,'$.name') AS name,
    COALESCE(json_extract(r.data,'$.reference'),'') AS reference,-SUM(m.quantity) AS quantityUsed,
    (SELECT COALESCE(SUM(total.quantity),0) FROM movements total WHERE total.part=m.part) AS remaining
    FROM movements m JOIN records r ON r.id=m.part WHERE m.intervention=? GROUP BY m.part HAVING SUM(m.quantity)<0 ORDER BY m.part`).bind(id).all();
  return rows.results;
}

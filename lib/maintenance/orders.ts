import { database } from '../store';
import { AppError, allowSite, type User } from '../auth';
import { validSite, validMachine } from './repository';
import { activePart, stockQuantity } from './parts';
import { canEditIntervention } from '../interventions/deletion';
import { stockMovementStatement, stockError } from './stock';

export async function prepareOrder(user: User, input: any) {
  if (typeof input.site !== 'string' || typeof input.name !== 'string' || !input.name.trim()) throw new AppError('Nom du devis et site obligatoires.');
  allowSite(user, input.site);
  await validSite(input.site);
  const db = database();
  const id = input.id || (typeof input.clientId === 'string' && /^[a-f0-9-]{36}$/.test(input.clientId) ? input.clientId : crypto.randomUUID());
  const row = await db.prepare('SELECT kind,site,data FROM records WHERE id=?').bind(id).first<{ kind: string; site: string; data: string }>();
  if (row && (row.kind !== 'order' || row.site !== input.site)) throw new AppError('Commande inaccessible pour ce site.', 403);
  if (input.id && !row) throw new AppError('Commande introuvable.', 404);
  const previous = row ? JSON.parse(row.data) : null;
  if (previous?.deleted) throw new AppError('Ce devis a été supprimé.', 404);
  if (row && !input.id) return {id,ops:[],receives:false,part:previous.part || '',quantity:previous.quantity,site:input.site}; // Safe retry of a newly created purchase.
  const quantity = stockQuantity(input.quantity ?? 1);
  const status = input.status || 'Devis';
  if (!['Devis', 'Commandé', 'Reçu', 'Annulé'].includes(status)) throw new AppError('Statut invalide.');
  const part = typeof input.part === 'string' ? input.part : '';
  if (input.orderMode === 'existing' && !part) throw new AppError('Choisissez la référence du magasin pour ce devis.');
  const alreadyReceived = previous?.status === 'Reçu';
  // A completed receipt is immutable; corrections require an explicit stock movement.
  if (alreadyReceived && (status !== 'Reçu' || quantity !== (previous.quantity ?? 1) || part !== (previous.part || '') ||
      input.name.trim() !== previous.name || String(input.reference || '') !== (previous.reference || '') ||
      (input.machine || '') !== (previous.machine || '')))
    throw new AppError('Cette réception est déjà enregistrée. Corrigez les quantités par une entrée ou une sortie de stock.', 409);
  if (row && (input.revision ?? 0) !== (previous.revision ?? 0)) {
    // A repeated "Reçu" click cannot credit the purchase twice.
    if (alreadyReceived && status === 'Reçu' && quantity === previous.quantity && part === (previous.part || '')) return {id,ops:[],receives:false,part,quantity,site:input.site};
    throw new AppError('Ce devis a changé. Rechargez-le avant de modifier.', 409);
  }
  if (input.machine) await validMachine(input.machine, input.site);
  const selectedPart = part && !alreadyReceived ? await activePart(part, input.site) : null;
  const created = new Date().toISOString();
  const receives = status === 'Reçu' && !alreadyReceived;
  const receivedPart = previous?.receivedPart || (part || 'purchase-part:' + id);
  const data = { ...previous, createdAt: previous?.createdAt || (row ? undefined : created), name: input.name.trim().slice(0, 150), supplier: String(input.supplier || '').trim().slice(0, 200),
    reference: selectedPart ? selectedPart.values.reference || '' : String(input.reference || '').trim().slice(0, 200),
    location: String(input.location || '').trim().slice(0, 200), machine: input.machine || '', part, quantity, status,
    revision: (previous?.revision || 0) + 1, receivedPart: receives ? receivedPart : previous?.receivedPart || '',
    receivedAt: receives ? created : previous?.receivedAt || '' };
  const write = row ? db.prepare(`UPDATE records SET data=CASE WHEN data=? THEN ? ELSE NULL END
    WHERE id=? AND kind='order' AND site=?`).bind(row.data, JSON.stringify(data), id, input.site)
    : db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(id, 'order', input.site, JSON.stringify(data));
  const ops = [write];
  if (input.intervention) {
    const report = await db.prepare('SELECT id,site,author_id,deleted,revision,machine_service,waiting_order,waiting_note FROM interventions WHERE id=?').bind(input.intervention).first<any>();
    if (!report || report.deleted) throw new AppError('Rapport en attente introuvable.',404);
    if (report.site !== input.site || !canEditIntervention(user,report)) throw new AppError('Association à ce rapport refusée.',403);
    if (report.machine_service !== 'Non') throw new AppError('Ce rapport ne signale pas une machine hors service.',409);
    if (report.waiting_order !== id) {
      if (report.waiting_order) throw new AppError('Ce rapport possède déjà un devis. Modifiez son association depuis le rapport.',409);
      if (input.interventionRevision !== report.revision) throw new AppError('Le rapport a changé. Rechargez la liste avant de l’associer.',409);
      const note = typeof input.waitingNote === 'string' && input.waitingNote.trim() ? input.waitingNote.trim() : report.waiting_note || [data.name,data.reference].filter(Boolean).join(' · ');
      if (note.length > 1000) throw new AppError('Précision d’attente limitée à 1 000 caractères.');
      ops.push(db.prepare(`UPDATE interventions SET waiting_note=CASE WHEN deleted=0 AND revision=? AND machine_service='Non' AND waiting_order IS NULL THEN ? ELSE NULL END,
        waiting_order=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=?`).bind(report.revision,note,id,created,user.id,report.id));
    }
  }
  if (receives) {
    if (!part) ops.push(db.prepare('INSERT INTO records(id,kind,site,data) VALUES(?,?,?,?)').bind(receivedPart, 'part', input.site,
      JSON.stringify({ name: data.name, reference: data.reference, supplier: data.supplier, location: data.location,
        machines: data.machine ? [data.machine] : [], minimum: 0, deleted: false })));
    ops.push(db.prepare('INSERT INTO purchase_receipts(order_id,part,site,quantity,actor,created) VALUES(?,?,?,?,?,?)')
      .bind(id, receivedPart, input.site, quantity, user.name, created));
    ops.push(stockMovementStatement({ id: 'receipt:' + id, part: receivedPart, site: input.site, quantity,
      machine: data.machine || null, reason: 'Réception · ' + data.name + (data.supplier ? ' · ' + data.supplier : ''),
      actor: user.name, created }));
  }
  return {id,ops,receives,part,quantity,site:input.site};
}
export async function saveOrder(user: User, input: any) {
  const {id,ops,receives,part,quantity,site} = await prepareOrder(user,input);
  if (!ops.length) return;
  const db = database();
  try { await db.batch(ops); }
  catch (error) {
    const issue = stockError(error);
    if (issue) throw issue;
    const saved = await db.prepare("SELECT data FROM records WHERE id=? AND kind='order' AND site=?").bind(id, site).first<{ data: string }>();
    if (receives && saved) {
      const values = JSON.parse(saved.data);
      if (!values.deleted && values.status === 'Reçu' && values.quantity === quantity && values.part === part) return;
    }
    if (!input.id && saved) {
      const values = JSON.parse(saved.data);
      if (!values.deleted && values.name === input.name.trim().slice(0,150) && values.quantity === quantity) return;
    }
    if (String(error).includes('NOT NULL constraint failed: interventions.waiting_note')) throw new AppError('Le rapport a été modifié ou supprimé pendant l’enregistrement. Rechargez-le ; le devis n’a pas été enregistré.',409);
    if (String(error).includes('NOT NULL constraint failed: records.data')) throw new AppError('Ce devis a changé pendant l’enregistrement. Rechargez-le.', 409);
    throw error;
  }
}
export async function deleteOrder(user: User, id: string) {
  if (user.role !== 'admin') throw new AppError('Seul l’admin peut supprimer un devis.', 403);
  const db = database();
  const order = await db.prepare("SELECT site FROM records WHERE id=? AND kind='order'").bind(id).first<{ site: string }>();
  if (!order) throw new AppError('Devis introuvable.', 404);
  allowSite(user, order.site);
  await db.prepare(`UPDATE records SET data=json_set(data,'$.deleted',1,'$.revision',COALESCE(json_extract(data,'$.revision'),0)+1)
    WHERE id=? AND kind='order' AND COALESCE(json_extract(data,'$.deleted'),0)=0`).bind(id).run();
}

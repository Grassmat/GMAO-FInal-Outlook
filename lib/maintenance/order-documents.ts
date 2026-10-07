import { env } from 'cloudflare:workers';
import { database } from '../store';
import { AppError, allowReadSite, allowSite, type User } from '../auth';
import { validatePdf } from './documents';

type OrderDocument = { id: string; order_id: string; site: string; name: string; object_key: string; size: number; actor: string; created: string };
function storage() {
  if (!env.BUCKET) throw new AppError('Le stockage des documents est indisponible. Réessayez.', 503);
  return env.BUCKET;
}
export async function orderForDocuments(user: User, id: string) {
  const row = await database().prepare("SELECT id,site,data FROM records WHERE id=? AND kind='order'").bind(id).first<{ id: string; site: string; data: string }>();
  if (!row || JSON.parse(row.data).deleted) throw new AppError('Devis absent ou supprimé.', 404);
  allowReadSite(user, row.site);
  return row;
}
export async function listOrderDocuments(user: User, order: string) {
  await orderForDocuments(user, order);
  return (await database().prepare('SELECT id,name,size,actor,created FROM order_documents WHERE order_id=? ORDER BY created DESC,id DESC').bind(order).all()).results;
}
export async function uploadOrderDocument(user: User, orderId: string, file: File, uploadId: string) {
  const order = await orderForDocuments(user, orderId);
  allowSite(user, order.site);
  if (!/^[a-f0-9-]{36}$/.test(uploadId)) throw new AppError('Identifiant d’envoi invalide.');
  const name = await validatePdf(file);
  const db = database();
  const existing = await db.prepare('SELECT order_id,name FROM order_documents WHERE id=?').bind(uploadId).first<{ order_id: string; name: string }>();
  if (existing) {
    if (existing.order_id !== orderId) throw new AppError('Cet identifiant de document est déjà utilisé.', 409);
    return { id: uploadId, name: existing.name };
  }
  const bucket = storage();
  // Each attempt owns a separate object, so a failed concurrent retry cannot delete the winner's PDF.
  const key = `order-documents/${orderId}/${uploadId}/${crypto.randomUUID()}.pdf`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: 'application/pdf' } });
  try {
    const result = await db.prepare(`INSERT INTO order_documents(id,order_id,site,name,object_key,size,actor,created)
      SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM records WHERE id=? AND kind='order' AND COALESCE(json_extract(data,'$.deleted'),0)=0)`)
      .bind(uploadId, orderId, order.site, name, key, file.size, user.name, new Date().toISOString(), orderId).run();
    if (!result.meta.changes) throw new AppError('Le devis a été supprimé pendant l’envoi du PDF.', 404);
    return { id: uploadId, name };
  } catch (error) {
    try { await bucket.delete(key); } catch (cleanup) { console.error('Quote document cleanup failed', cleanup); }
    const committed = await db.prepare('SELECT order_id,name FROM order_documents WHERE id=?').bind(uploadId).first<{ order_id: string; name: string }>();
    if (committed?.order_id === orderId) return { id: uploadId, name: committed.name };
    throw error;
  }
}
export async function readOrderDocument(user: User, id: string) {
  const document = await database().prepare('SELECT * FROM order_documents WHERE id=?').bind(id).first<OrderDocument>();
  if (!document) throw new AppError('Document introuvable.', 404);
  await orderForDocuments(user, document.order_id);
  allowReadSite(user, document.site);
  const object = await storage().get(document.object_key);
  if (!object) throw new AppError('Le PDF est indisponible. Contactez l’admin.', 503);
  return { document, object };
}

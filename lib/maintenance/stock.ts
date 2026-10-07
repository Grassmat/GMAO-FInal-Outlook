import { database } from '../store';
import { AppError, allowReadSite, type User } from '../auth';
import { validSite } from './repository';
import type { StockPart } from '../interventions/types';

export async function listStock(user: User, site: string): Promise<StockPart[]> {
  allowReadSite(user, site);
  await validSite(site);
  const rows = await database().prepare(`SELECT r.id,r.data,
    COALESCE((SELECT SUM(m.quantity) FROM movements m WHERE m.part=r.id),0) AS quantity
    FROM records r WHERE r.kind='part' AND r.site=? AND COALESCE(json_extract(r.data,'$.deleted'),0)=0`).bind(site).all<{ id: string; data: string; quantity: number }>();
  return rows.results.map(row => {
    const data = JSON.parse(row.data);
    return { id: row.id, name: data.name, reference: data.reference || '', location: data.location || '',
      supplier: data.supplier || '', machines: data.machines || [], quantity: row.quantity };
  });
}

// A failing stock check must abort the whole D1 batch, including the report and other parts.
// The NOT NULL quantity constraint turns insufficient stock into a transaction failure.
export function stockMovementStatement(input: {
  id: string; part: string; site: string; quantity: number; machine: string | null;
  reason: string; actor: string; created: string; intervention?: string;
}) {
  return database().prepare(`INSERT INTO movements(id,part,site,quantity,machine,reason,actor,created,intervention)
    VALUES(?,CASE WHEN EXISTS(SELECT 1 FROM records WHERE id=? AND kind='part' AND site=?
      AND COALESCE(json_extract(data,'$.deleted'),0)=0) THEN ? ELSE NULL END,?,
      CASE WHEN COALESCE((SELECT SUM(quantity) FROM movements WHERE part=?),0)+? >=0
      THEN ? ELSE NULL END,?,?,?,?,?)`).bind(input.id, input.part, input.site, input.part, input.site, input.part,
      input.quantity, input.quantity, input.machine, input.reason, input.actor, input.created, input.intervention || null);
}

export function stockError(error: unknown) {
  const messages: string[] = [];
  let cause = error;
  for (let i = 0; cause && i < 5; i++) {
    messages.push(cause instanceof Error ? cause.message : String(cause));
    cause = cause instanceof Error ? cause.cause : undefined;
  }
  if (messages.some(message => message.includes('NOT NULL constraint failed: movements.part')))
    return new AppError('Une référence a été supprimée du magasin pendant la saisie. Actualisez le stock et choisissez une référence active. Aucun mouvement n’a été enregistré.', 400);
  return messages.some(message => message.includes('NOT NULL constraint failed: movements.quantity')) ? insufficientStock() : null;
}

export function insufficientStock() {
  return new AppError('Stock insuffisant : une quantité a changé pendant la saisie. Actualisez le stock et ajustez les quantités. Aucun prélèvement n’a été enregistré.', 400);
}

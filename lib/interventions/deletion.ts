import { database } from '../store';
import { AppError, allowSite, globalAccess, type User } from '../auth';
import type { InterventionDeleteResult } from './types';

type ReportOwner = { site: string; author_id: string | null };
export function canDeleteIntervention(user: User, report: ReportOwner): boolean {
  return (globalAccess(user) || user.site === report.site) && (user.role === 'admin' || report.author_id === user.id);
}

export function canEditIntervention(user: User, report: ReportOwner): boolean {
  return (globalAccess(user) || user.site === report.site) && (globalAccess(user) || report.author_id === user.id);
}

export async function deleteIntervention(user: User, id: string): Promise<InterventionDeleteResult> {
  const db = database();
  const report = await db.prepare('SELECT site,author_id FROM interventions WHERE id=?').bind(id).first<ReportOwner>();
  if (!report) throw new AppError('Rapport introuvable.', 404);
  allowSite(user, report.site);
  if (!canDeleteIntervention(user, report)) throw new AppError('Vous pouvez supprimer uniquement les rapports que vous avez remplis. L’admin peut tous les supprimer.', 403);
  const created = new Date().toISOString();
  // Reverse the actual withdrawals, never a quantity inferred from text or form answers.
  // Stable movement IDs and the active-report condition make concurrent deletions and retries harmless.
  // Keep both original and opposite movements as an audit trail, including retired stock references.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO movements(id,part,site,quantity,machine,reason,actor,created,intervention)
      SELECT 'intervention-reversal:' || i.id || ':' || m.part,m.part,m.site,-SUM(m.quantity),NULL,
        'Annulation du rapport · ' || i.id,?,?,m.intervention
      FROM movements m JOIN interventions i ON i.id=m.intervention
      WHERE i.id=? AND i.deleted=0 GROUP BY m.part HAVING SUM(m.quantity)<0`).bind(user.name, created, id),
    db.prepare('UPDATE interventions SET deleted=1,deleted_by=?,deleted_at=? WHERE id=? AND deleted=0').bind(user.id, created, id),
    db.prepare("UPDATE records SET data=json_set(data,'$.status','planned','$.reportId',NULL,'$.completedAt',NULL,'$.revision',json_extract(data,'$.revision')+1) WHERE kind='plan' AND json_extract(data,'$.reportId')=? AND json_extract(data,'$.status')='done'").bind(id),
  ]);
  const restored = await db.prepare(`SELECT m.part,json_extract(r.data,'$.name') AS name,
    COALESCE(json_extract(r.data,'$.reference'),'') AS reference,SUM(m.quantity) AS quantityRestored,
    (SELECT COALESCE(SUM(total.quantity),0) FROM movements total WHERE total.part=m.part) AS remaining
    FROM movements m JOIN records r ON r.id=m.part
    WHERE m.intervention=? AND m.id GLOB 'intervention-reversal:*' GROUP BY m.part ORDER BY m.part`).bind(id)
    .all<InterventionDeleteResult['stockRestored'][number]>();
  return { id, stockRestored: restored.results };
}

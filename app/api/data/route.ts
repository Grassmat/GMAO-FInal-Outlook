
import { currentUser, sameOrigin, json, replyError } from '../../../lib/auth';
import { readMaintenance, writeMaintenance } from '../../../lib/maintenance/service';
import { database } from '../../../lib/store';
export async function GET(req: Request) {
  try {
    return json(await readMaintenance(await currentUser(req)));
  }
  catch (e) {
    return replyError(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const user = await currentUser(req);
    const input: any = await req.json();
    await writeMaintenance(user, input);
    const saved = input.kind === 'order' && input.action !== 'delete-order' && (input.id || input.clientId)
      ? await database().prepare("SELECT id,kind,site,data FROM records WHERE id=? AND kind='order' AND site=?").bind(input.id || input.clientId, input.site).first<{ id: string; kind: string; site: string; data: string }>() : null;
    return json({ ok: true, ...(saved ? { record: { id: saved.id, kind: saved.kind, site: saved.site, ...JSON.parse(saved.data) } } : {}) });
  }
  catch (e) {
    return replyError(e);
  }
}

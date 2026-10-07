
import { currentUser, sameOrigin, AppError, json, replyError } from '../../../lib/auth';
import { listInterventions, getInterventionForm, createIntervention, updateIntervention, interventionStockUpdates } from '../../../lib/interventions/service';
import { documentFormData } from '../../../lib/maintenance/documents';
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const url = new URL(request.url);
    const site = url.searchParams.get('site');
    if (!site) throw new AppError('Site obligatoire.');
    const listing = await listInterventions(user, site, url.searchParams.get('machine'));
    return json({ ...listing, form: await getInterventionForm(site) });
  } catch (error) {
    return replyError(error)
  }
}
export async function POST(request: Request) { return save(request, false); }
export async function PATCH(request: Request) { return save(request, true); }
async function save(request: Request, editing: boolean) {
  try {
    sameOrigin(request);
    const user = await currentUser(request);
    let input: any;
    const uploads = new Map<string, File[]>();
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
      const form = await documentFormData(request, 26 * 1024 * 1024, 'Les photos dépassent la limite totale de 25 Mo.');
      const payload = form.get('payload');
      if (typeof payload !== 'string' || payload.length > 1024 * 1024) throw new AppError('Rapport invalide.');
      try {
        input = JSON.parse(payload)
      } catch {
        throw new AppError('Rapport invalide.')
      }
      ;
      for (const [key, value] of form.entries()) if (key.startsWith('photo:') && value instanceof File) {
        const field = key.slice(6);
        uploads.set(field, [...(uploads.get(field) || []), value])
      }
    } else {
      const text = await request.text();
      if (text.length > 1024 * 1024) throw new AppError('Rapport trop volumineux.');
      try {
        input = JSON.parse(text)
      } catch {
        throw new AppError('Rapport invalide.')
      }
    }
    const result = await (editing ? updateIntervention : createIntervention)(user, input, uploads);
    return json({ ...result, stockUpdates: await interventionStockUpdates(result.id) });
  } catch (error) {
    return replyError(error)
  }
}

import { AppError, currentUser, sameOrigin, json, replyError } from '../../../lib/auth';
import { listDocuments, uploadDocument, documentFormData } from '../../../lib/maintenance/documents';
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const machine = new URL(request.url).searchParams.get('machine');
    if (!machine) throw new AppError('Machine obligatoire.');
    return json({ documents: await listDocuments(user, machine) });
  } catch (error) { return replyError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser(request);
    const form = await documentFormData(request);
    const machine = form.get('machine');
    const file = form.get('file');
    if (typeof machine !== 'string' || !(file instanceof File)) throw new AppError('Machine et PDF obligatoires.');
    return json({ document: await uploadDocument(user, machine, file) });
  } catch (error) { return replyError(error); }
}

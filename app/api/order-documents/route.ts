import { AppError, currentUser, sameOrigin, json, replyError } from '../../../lib/auth';
import { documentFormData } from '../../../lib/maintenance/documents';
import { listOrderDocuments, uploadOrderDocument } from '../../../lib/maintenance/order-documents';
export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const order = new URL(request.url).searchParams.get('order');
    if (!order) throw new AppError('Devis obligatoire.');
    return json({ documents: await listOrderDocuments(user, order) });
  } catch (error) { return replyError(error); }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser(request);
    const form = await documentFormData(request);
    const order = form.get('order'), file = form.get('file'), uploadId = form.get('uploadId');
    if (typeof order !== 'string' || !(file instanceof File) || typeof uploadId !== 'string') throw new AppError('Devis et PDF obligatoires.');
    return json({ document: await uploadOrderDocument(user, order, file, uploadId) });
  } catch (error) { return replyError(error); }
}

import { currentUser, AppError, json, replyError } from '../../../../lib/auth';
import { listStock } from '../../../../lib/maintenance/stock';

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const site = new URL(request.url).searchParams.get('site');
    if (!site) throw new AppError('Site obligatoire.');
    return json({ parts: await listStock(user, site) });
  } catch (error) {
    return replyError(error);
  }
}

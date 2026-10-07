
import { currentUser, replyError } from '../../../../../../lib/auth';
import { interventionFile } from '../../../../../../lib/interventions/service';
export async function GET(request: Request, context: { params: Promise<{ id: string; file: string }> }) {
  try {
    const user = await currentUser(request);
    const params = await context.params;
    const { file, object } = await interventionFile(user, params.id, params.file);
    return new Response(object.body, { headers: { 'Content-Type': file.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
  } catch (error) {
    return replyError(error)
  }
}

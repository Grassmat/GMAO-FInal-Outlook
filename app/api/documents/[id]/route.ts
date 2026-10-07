import { currentUser, replyError } from '../../../../lib/auth';
import { readDocument } from '../../../../lib/maintenance/documents';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser(request);
    const { id } = await context.params;
    const { document, object } = await readDocument(user, id);
    const mode = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(object.body, { headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(document.size),
      'Content-Disposition': `${mode}; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox',
    } });
  } catch (error) { return replyError(error); }
}

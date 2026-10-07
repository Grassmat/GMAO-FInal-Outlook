import { currentUser, replyError } from '../../../../lib/auth';
import { readOrderDocument } from '../../../../lib/maintenance/order-documents';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser(request);
    const { document, object } = await readOrderDocument(user, (await context.params).id);
    const mode = new URL(request.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
    return new Response(object.body, { headers: {
      'Content-Type': 'application/pdf', 'Content-Length': String(document.size),
      'Content-Disposition': `${mode}; filename="devis.pdf"; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox',
    } });
  } catch (error) { return replyError(error); }
}

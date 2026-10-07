import { currentUser, sameOrigin, json, replyError } from '../../../../lib/auth';
import { deleteIntervention } from '../../../../lib/interventions/deletion';
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const user = await currentUser(request);
    const { id } = await context.params;
    return json(await deleteIntervention(user, id));
  } catch (error) {
    return replyError(error);
  }
}

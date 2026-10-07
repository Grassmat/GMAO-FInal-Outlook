
import { currentUser, sameOrigin, json, replyError } from '../../../../lib/auth';
import { getInterventionForm, updateInterventionForm } from '../../../../lib/interventions/service';
export async function GET(request: Request) {
  try {
    await currentUser(request);
    return json(await getInterventionForm());
  } catch (error) {
    return replyError(error)
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser(request);
    await updateInterventionForm(user, await request.json());
    return json({ ok: true });
  } catch (error) {
    return replyError(error)
  }
}

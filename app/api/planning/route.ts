import { queuePlanNotification,queueRoutineReminders,dispatchMail } from '../../../lib/mail/planning';
import { mailReady } from '../../../lib/mail/provider';
import { planningAccess, setPlanningPermission } from '../../../lib/planning/permissions';
import { deletePlanning } from '../../../lib/planning/deletion';
import { listTeammates } from '../../../lib/planning/assignments';
import { currentUser, sameOrigin, json, replyError, AppError } from '../../../lib/auth';
import { listRoutines, saveRoutine, completeRoutine } from '../../../lib/planning/routines';
import { listPlans, savePlan } from '../../../lib/planning/service';
export async function GET(request: Request) { try {
    const user = await currentUser(request), site = new URL(request.url).searchParams.get('site');
    if (!site)
        throw new AppError('Site obligatoire.');
    return json({ mailReady:await mailReady('notification'), access: await planningAccess(user, site), teammates: await listTeammates(user, site), plans: await listPlans(user, site), ...await listRoutines(user, site) });
}
catch (error) {
    return replyError(error);
} }
export async function POST(request: Request) { try {
    sameOrigin(request);
    const user = await currentUser(request), text = await request.text();
    if (text.length > 100000)
        throw new AppError('Planning trop volumineux.');
    const input = JSON.parse(text);
    const result=await (input.action === 'permission' ? setPlanningPermission : input.action === 'delete' ? deletePlanning : input.action === 'routine-done' ? completeRoutine : input.action === 'routine' ? saveRoutine : savePlan)(user, input);
    if(!input.action && !input.id && input.notifyEmail) {
      try {const notification=await queuePlanNotification((result as {id:string}).id);await dispatchMail();return json({...result,notification,mailReady:await mailReady('notification')});}
      catch {return json({...result,notificationWarning:'Intervention enregistrée ; la notification mail n’a pas pu être préparée.'});}
    }
    if(input.action==='routine' && input.emailReminder && input.emailReminder!=='none') {try{await queueRoutineReminders();await dispatchMail();}catch{/* Persisted task remains valid when sending is unavailable. */}}
    return json(result);
}
catch (error) {
    return replyError(error);
} }

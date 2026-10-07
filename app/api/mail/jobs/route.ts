import { database } from '../../../../lib/store';
import { env } from 'cloudflare:workers';
import { currentUser,sameOrigin,json,replyError,AppError,digest } from '../../../../lib/auth';
import { dispatchMail,queueRoutineReminders } from '../../../../lib/mail/planning';
import { mailReady } from '../../../../lib/mail/provider';
export async function POST(req:Request){try{
 const key=req.headers.get('x-gmao-scheduler')||'',expected=(env as unknown as Record<string,string>).MAIL_JOB_TOKEN_HASH;
 if(!expected||await digest(key)!==expected){sameOrigin(req);const u=await currentUser(req);if(!['admin','director'].includes(u.role))throw new AppError('Accès refusé.',403);}
 if(!await mailReady('notification'))return json({ready:false,message:'Service mail à configurer.'});
 const queued=await queueRoutineReminders();const result=await dispatchMail();const pending=await database().prepare("SELECT COUNT(*) AS count FROM email_outbox WHERE state='pending' AND lease<?").bind(Date.now()).first<{count:number}>();return json({queued,...result,pending:pending?.count||0});
}catch(e){return replyError(e);}}

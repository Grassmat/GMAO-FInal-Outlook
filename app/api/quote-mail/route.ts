import { submitQuoteRequest } from '../../../lib/mail/quote-approval';
import { database } from '../../../lib/store';
import { currentUser,sameOrigin,json,replyError,AppError } from '../../../lib/auth';
import { quoteMailSettings,setQuoteMailSettings,confirmSiteSender } from '../../../lib/mail/site-settings';
import { dispatchMail } from '../../../lib/mail/planning';
import { accountRateLimit } from '../../../lib/account/links';
import { normalizeEmail } from '../../../lib/account/email';
import { mailReady } from '../../../lib/mail/provider';
export async function GET(req:Request){try{const u=await currentUser(req),site=new URL(req.url).searchParams.get('site');if(!site)throw new AppError('Site obligatoire.');return json(await quoteMailSettings(u,site));}catch(e){return replyError(e);}}
export async function POST(req:Request){try{
 sameOrigin(req);const user=await currentUser(req),text=await req.text();if(text.length>25000)throw new AppError('Message trop volumineux.');const b=JSON.parse(text);
 if(b.action==='settings'||b.action==='permission')return json(await setQuoteMailSettings(user,b));
 if(b.action==='confirm-sender')return json(await confirmSiteSender(user,b.site));
 const access=await quoteMailSettings(user,b.site);if(!access.canSubmit)throw new AppError('Vous ne pouvez pas soumettre une demande pour ce site.',403);
 if(!access.settings?.confirmed)throw new AppError('L’adresse d’expédition du site doit être confirmée.');
 if(!access.mailReady)throw new AppError('Le service d’envoi de mails n’est pas encore activé.',503);
 if(typeof b.id!=='string'||!/^[a-f0-9-]{36}$/.test(b.id)||typeof b.subject!=='string'||!b.subject.trim()||b.subject.length>200||typeof b.body!=='string'||!b.body.trim()||b.body.length>15000)throw new AppError('Objet et message valides obligatoires.');
 const to=normalizeEmail(b.to),sender=access.settings.sender_email,db=database();
 await accountRateLimit('quote-mail:'+user.id,20);
 return json(await submitQuoteRequest(user,{id:b.id,site:b.site,to,subject:b.subject.trim(),body:b.body,details:b.details},access.settings));
}catch(e){return replyError(e);}}

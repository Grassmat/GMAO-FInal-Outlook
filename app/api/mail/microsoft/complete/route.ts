import { currentUser,sameOrigin,AppError } from '../../../../../lib/auth';
import { appOrigin,finishMicrosoftConnection } from '../../../../../lib/mail/configuration';
export async function POST(req:Request){
 let message='Connexion Outlook terminée.';
 try{sameOrigin(req);const user=await currentUser(req),text=await req.text();if(text.length>10000)throw new AppError('Autorisation trop volumineuse.');const data=new URLSearchParams(text),cookie=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-gmao_microsoft='))?.slice('__Host-gmao_microsoft='.length)||'';const result=await finishMicrosoftConnection(user,data.get('state')||'',cookie,data.get('code')||'');message='Boîte connectée : '+result.sender;}catch(e){message=e instanceof AppError?e.message:'Connexion Outlook indisponible. Réessayez.';}
 return new Response(null,{status:303,headers:{Location:appOrigin()+'/#mail-setup='+encodeURIComponent(message),'Set-Cookie':'__Host-gmao_microsoft=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}

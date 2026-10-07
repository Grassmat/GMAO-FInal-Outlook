import { appOrigin } from '../../../../../lib/mail/configuration';
// Session cookies remain SameSite=Strict. The Microsoft return first establishes
// our own site context; an explicit same-origin POST then completes OAuth.
// no-referrer makes browser navigation POST Origin=null. Keep same-origin
// referrers, strip the callback query immediately, and retain strict Origin validation.
export async function GET(req:Request){
 const url=new URL(req.url),code=url.searchParams.get('code')||'',state=url.searchParams.get('state')||'';
 const valid=!url.searchParams.get('error')&&code.length>0&&code.length<=4096&&/^[a-f0-9]{64}$/.test(state);
 const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)),nonce=crypto.randomUUID();
 const body=valid?`<p>Microsoft a renvoyé votre autorisation. Finalisez la connexion de cette boîte à la GMAO.</p><form method="post" action="/api/mail/microsoft/complete"><input type="hidden" name="code" value="${escape(code)}"><input type="hidden" name="state" value="${state}"><button>Finaliser la connexion Outlook</button></form>`:'<p>Autorisation Microsoft annulée ou invalide. Retournez dans les réglages pour réessayer.</p>';
 return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connexion Outlook — GMAO</title><main><h1>Connexion Outlook</h1>${body}<p><a href="/">Retour à la GMAO</a></p></main><script nonce="${nonce}">history.replaceState(null,'','/api/mail/microsoft/callback');</script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'same-origin','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; form-action ${appOrigin()}; frame-ancestors 'none'; base-uri 'none'`}});
}

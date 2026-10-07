import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
function load(file,deps,names){const input=fs.readFileSync(file,'utf8').replace(/^import .*;$/gm,'').replace(/\bexport /g,'');const code=ts.transpile(input,{target:ts.ScriptTarget.ES2022});return new Function(...Object.keys(deps),code+';return {'+names.join(',')+'};')(...Object.values(deps));}
const origin='https://app.test.invalid';
class AppError extends Error{}
const sameOrigin=req=>{if(req.headers.get('origin')!==new URL(req.url).origin)throw new AppError('Origine refusée.');};
let completed=0;
const callback=load('app/api/mail/microsoft/callback/route.ts',{appOrigin:()=>origin},['GET']);
const complete=load('app/api/mail/microsoft/complete/route.ts',{AppError,sameOrigin,appOrigin:()=>origin,currentUser:async()=>({id:'manager'}),finishMicrosoftConnection:async(user,state,cookie,code)=>{assert.equal(state,'a'.repeat(64));assert.equal(cookie,state);assert.equal(code,'fixture-code');completed++;return {sender:'fixture@example.org'};}},['POST']);
const page=await callback.GET(new Request(origin+'/api/mail/microsoft/callback?state='+'a'.repeat(64)+'&code=%22%3E%3Cscript%3Efixture%3C%2Fscript%3E'));
assert.equal(page.headers.get('Referrer-Policy'),'same-origin');assert.equal(page.headers.get('Cache-Control'),'no-store');assert(page.headers.get('Content-Security-Policy').includes('form-action '+origin));const html=await page.text();assert(html.includes('history.replaceState'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('value=""><script>'));assert(html.includes('method="post"'));
function request(requestOrigin){const headers={'Content-Type':'application/x-www-form-urlencoded',cookie:'__Host-gmao_microsoft='+'a'.repeat(64)};if(requestOrigin!==undefined)headers.origin=requestOrigin;return new Request(origin+'/api/mail/microsoft/complete',{method:'POST',headers,body:new URLSearchParams({state:'a'.repeat(64),code:'fixture-code'})});}
for(const value of [undefined,'null','https://attacker.test.invalid']){const denied=await complete.POST(request(value));assert(denied.headers.get('location').includes(encodeURIComponent('Origine refusée.')));assert.equal(completed,0);}
const accepted=await complete.POST(request(origin));assert.equal(accepted.status,303);assert(accepted.headers.get('location').includes(encodeURIComponent('Boîte connectée : fixture@example.org')));assert.equal(completed,1);assert(accepted.headers.get('set-cookie').includes('Max-Age=0'));
console.log('PASS: callback referrer policy preserves same-origin form POST, callback query removal, escaped authorization values, restricted form destination, strict absent/null/foreign Origin denial and authenticated completion.');

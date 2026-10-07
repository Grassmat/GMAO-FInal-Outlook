import { env } from 'cloudflare:workers';
import { database } from '../../../../lib/store';
import { currentUser, sameOrigin, replyError, json, AppError } from '../../../../lib/auth';
export async function GET(req:Request){try{
 const u=await currentUser(req,false);if(!u.avatar_key)throw new AppError('Aucune photo.',404);
 const object=await env.BUCKET?.get(u.avatar_key);if(!object)throw new AppError('Photo introuvable.',404);
 return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'"}});
}catch(e){return replyError(e);}}
export async function POST(req:Request){let key='';try{
 sameOrigin(req);const u=await currentUser(req,false);
 if(Number(req.headers.get('content-length')||0)>2200000)throw new AppError('Photo trop volumineuse (2 Mo maximum).');
 const form=await req.formData(),file=form.get('file');
 if(!(file instanceof File)||!file.size||file.size>2*1024*1024)throw new AppError('Photo obligatoire, 2 Mo maximum.');
 const bytes=new Uint8Array(await file.arrayBuffer()),png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
 const mime=png?'image/png':jpeg?'image/jpeg':webp?'image/webp':'';
 if(!mime||mime!==file.type)throw new AppError('Utilisez une image PNG, JPEG ou WebP.');
 if(!env.BUCKET)throw new AppError('Stockage des photos indisponible.',503);
 key='profiles/'+u.id+'/'+crypto.randomUUID();await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:mime}});
 const update=await database().prepare('UPDATE users SET avatar_key=?,avatar_version=avatar_version+1 WHERE id=? AND avatar_version=?').bind(key,u.id,u.avatar_version||0).run();
 if(!update.meta.changes)throw new AppError('Photo modifiée entre-temps. Rechargez votre profil.',409);
 if(u.avatar_key)await env.BUCKET.delete(u.avatar_key).catch(()=>{});
 return json({ok:true});
}catch(e){if(key)await env.BUCKET?.delete(key).catch(()=>{});return replyError(e);}}
export async function DELETE(req:Request){try{
 sameOrigin(req);const u=await currentUser(req,false);
 const update=await database().prepare("UPDATE users SET avatar_key='',avatar_version=avatar_version+1 WHERE id=? AND avatar_version=?").bind(u.id,u.avatar_version||0).run();
 if(!update.meta.changes)throw new AppError('Photo modifiée entre-temps.',409);
 if(u.avatar_key)await env.BUCKET?.delete(u.avatar_key).catch(()=>{});return json({ok:true});
}catch(e){return replyError(e);}}

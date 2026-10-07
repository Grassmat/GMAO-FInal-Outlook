import { currentUser,sameOrigin,json,replyError,AppError } from '../../../../lib/auth';
import { getQuoteRequest,listQuoteRequests,decideQuoteRequest,deleteQuoteRequest,editQuoteRequest } from '../../../../lib/mail/quote-approval';
export async function GET(req:Request){try{const u=await currentUser(req),url=new URL(req.url),id=url.searchParams.get('id'),site=url.searchParams.get('site');if(id)return json(await getQuoteRequest(u,id));if(site)return json(await listQuoteRequests(u,site));throw new AppError('Site ou demande obligatoire.');}catch(e){return replyError(e);}}
export async function POST(req:Request){try{sameOrigin(req);const u=await currentUser(req),text=await req.text();if(text.length>4096)throw new AppError('Demande trop volumineuse.');return json(await decideQuoteRequest(u,JSON.parse(text)));}catch(e){return replyError(e);}}

export async function DELETE(req:Request){try{sameOrigin(req);const u=await currentUser(req),text=await req.text();if(text.length>4096)throw new AppError('Demande trop volumineuse.');return json(await deleteQuoteRequest(u,JSON.parse(text)));}catch(e){return replyError(e);}}

export async function PATCH(req:Request){try{sameOrigin(req);const u=await currentUser(req),text=await req.text();if(text.length>25000)throw new AppError('Demande trop volumineuse.');return json(await editQuoteRequest(u,JSON.parse(text)));}catch(e){return replyError(e);}}

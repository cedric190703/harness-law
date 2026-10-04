import { addDocuments, agents, artifact, cancelRun, createProject, getProject, listProjects, skillInfo, startRun } from '@/lib/harness/engine';
import type { Provider } from '@/lib/harness/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function local(request:Request,write=false){
  const host=request.headers.get('host')||'';
  if(process.env.SAUL_EN_LIGNE!=='1'&&!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host))throw new Error('This application only accepts local connections.');
  if(write&&request.headers.get('origin')!==`http://${host}`&&request.headers.get('origin')!==`https://${host}`)throw new Error('Request origin refused.');
}
async function boundedBody(request:Request,limit:number){
  const reader=request.body?.getReader();if(!reader)throw new Error('A request body is required');const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error('Upload too large.');}chunks.push(value)}
  return Buffer.concat(chunks);
}
export async function GET(request:Request,{params}:{params:Promise<{path:string[]}>}){
  try{local(request);const segments=(await params).path;const [resource,id,action,runId,name]=segments;
    if(resource==='projects'&&!id)return Response.json(listProjects(),{headers:{'Cache-Control':'no-store'}});
    if(resource==='projects'&&id&&!action)return Response.json(getProject(id),{headers:{'Cache-Control':'no-store'}});
    if(resource==='agents')return Response.json(agents());
    if(resource==='skill')return Response.json(skillInfo());
    if(resource==='projects'&&action==='artifacts'&&runId&&name){const data=artifact(id,runId,name);return new Response(data,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
    return Response.json({error:'Unknown route'},{status:404});
  }catch(error){return Response.json({error:(error as Error).message},{status:400});}
}
export async function POST(request:Request,{params}:{params:Promise<{path:string[]}>}){
  try{local(request,true);const [resource,id,action,runId]=(await params).path;
    if(resource!=='projects')return Response.json({error:'Unknown route'},{status:404});
    if(action==='documents'){
      const bytes=await boundedBody(request,50*1024*1024);
      const body=await new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
      const files=await Promise.all(body.getAll('files').filter((f):f is File=>typeof f!=='string').map(async f=>({name:f.name,data:Buffer.from(await f.arrayBuffer())})));
      if(!files.length)throw new Error('No file received.');return Response.json(addDocuments(id,files));
    }
    const raw=await boundedBody(request,100_000);const data=JSON.parse(raw.toString()) as Record<string,unknown>;
    if(!id)return Response.json(createProject(String(data.name||''),String(data.description||'')),{status:201});
    if(action==='runs')return Response.json(startRun(id,String(data.prompt||''),data.provider as Provider,Number(data.budget??2),data.useCaseId?String(data.useCaseId):undefined),{status:202});
    if(action==='cancel'&&runId)return Response.json(cancelRun(id,runId));
    return Response.json({error:'Unknown route'},{status:404});
  }catch(error){return Response.json({error:(error as Error).message},{status:400});}
}

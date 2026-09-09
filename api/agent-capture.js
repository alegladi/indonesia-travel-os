import { getDb } from '../lib/brain-db.js';
import { requireAgent } from '../lib/brain-agent-auth.js';

const AREAS=new Set(['VITA PRIVATA','DA NIALTRI','ARREDO SERVICE','ALEGLADI']);

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!requireAgent(req,res)) return;
  const {kind='note',title,body='',suggestedArea=null,sourceId=null,payload={}}=req.body||{};
  if(!title||typeof title!=='string'||title.length>500) return res.status(400).json({error:'INVALID_TITLE'});
  if(body&&typeof body!=='string') return res.status(400).json({error:'INVALID_BODY'});
  if(suggestedArea&&!AREAS.has(suggestedArea)) return res.status(400).json({error:'INVALID_AREA'});
  try{
    const sql=getDb();
    const rows=await sql`INSERT INTO brain_inbox(kind,title,body,suggested_area,source,source_id,payload)
      VALUES(${String(kind).slice(0,80)},${title.trim()},${body.slice(0,20000)},${suggestedArea},'chatgpt',${sourceId},${JSON.stringify(payload)}::jsonb)
      RETURNING id,kind,title,suggested_area,status,created_at`;
    return res.status(201).json({ok:true,item:rows[0]});
  }catch(error){
    console.error('agent-capture',error);
    return res.status(503).json({error:error?.message==='DATABASE_NOT_CONFIGURED'?'DATABASE_NOT_CONFIGURED':'CAPTURE_UNAVAILABLE'});
  }
}

import { requireAuth } from '../lib/brain-auth.js';
import { getDb } from '../lib/brain-db.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!(await requireAuth(req,res))) return;
  if(req.method!=='GET') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{const sql=getDb();const rows=await sql`SELECT id,area,kind,title,source_type,source_id,occurred_at,payload FROM brain_activity ORDER BY occurred_at DESC LIMIT 200`;return res.status(200).json({events:rows,generatedAt:new Date().toISOString()})}catch(error){return res.status(503).json({error:error.message})}
}

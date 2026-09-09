import { getDb } from '../lib/brain-db.js';
import { requireAgent } from '../lib/brain-agent-auth.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!requireAgent(req,res)) return;
  try{
    const sql=getDb();
    const [tasks,projects,inbox,finance]=await Promise.all([
      sql`SELECT id,title,area,project,status,priority,due_at,owner,notes,updated_at FROM brain_tasks WHERE status NOT IN ('done','cancelled') ORDER BY priority ASC, due_at NULLS LAST, updated_at DESC LIMIT 100`,
      sql`SELECT id,name,area,objective,status,next_action,owner,due_at,blockers,updated_at FROM brain_projects WHERE status='active' ORDER BY updated_at DESC LIMIT 100`,
      sql`SELECT id,kind,title,body,suggested_area,source,status,created_at FROM brain_inbox WHERE status='new' ORDER BY created_at DESC LIMIT 50`,
      sql`SELECT id,label,amount_cents,currency,direction,due_at,paid_at,recurring,confidence,notes FROM brain_finance_entries WHERE (paid_at IS NULL OR due_at>=now()-interval '30 days') ORDER BY due_at NULLS LAST LIMIT 100`
    ]);
    return res.status(200).json({generatedAt:new Date().toISOString(),tasks,projects,inbox,finance});
  }catch(error){
    console.error('agent-context',error);
    return res.status(503).json({error:error?.message==='DATABASE_NOT_CONFIGURED'?'DATABASE_NOT_CONFIGURED':'CONTEXT_UNAVAILABLE'});
  }
}

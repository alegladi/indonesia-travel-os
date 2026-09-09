import { requireSession } from '../lib/brain-session.js';
import { getDb } from '../lib/brain-db.js';
import { securityResponseHeaders } from '../lib/brain-security.js';

async function timed(name, fn){
  const t=Date.now();
  try{return{name,ok:true,latencyMs:Date.now()-t,value:await fn()}}
  catch{return{name,ok:false,latencyMs:Date.now()-t}}
}

export default async function handler(req,res){
  securityResponseHeaders(res);
  if(!await requireSession(req,res)) return;
  if(req.method!=='GET') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const db=await timed('database',async()=>{const sql=getDb();await sql`SELECT 1`;return true});
  let integrations=[]; let recentSync=[]; let recentActivity=[];
  if(db.ok){
    const sql=getDb();
    [integrations,recentSync,recentActivity]=await Promise.all([
      sql`SELECT provider,account_key,account_email,status,updated_at FROM brain_integrations ORDER BY provider,account_key`,
      sql`SELECT source,account,status,started_at,finished_at,items_seen,items_changed FROM brain_sync_runs ORDER BY started_at DESC LIMIT 20`,
      sql`SELECT id,area,kind,title,source_type,occurred_at,payload FROM brain_activity ORDER BY occurred_at DESC LIMIT 30`
    ]);
  }
  const failingIntegrations=integrations.filter(x=>x.status!=='connected');
  const status=!db.ok?'PROBLEM':failingIntegrations.length?'ATTENTION':'HEALTHY';
  return res.status(200).json({status,generatedAt:new Date().toISOString(),checks:{database:{ok:db.ok,latencyMs:db.latencyMs}},integrations,recentSync,recentActivity,metrics:{integrationCount:integrations.length,failingIntegrations:failingIntegrations.length}});
}

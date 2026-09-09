import { requireAuth } from '../lib/brain-auth.js';
import { getDb } from '../lib/brain-db.js';

async function timed(name, fn){const t=Date.now();try{const value=await fn();return{name,ok:true,latencyMs:Date.now()-t,value}}catch(e){return{name,ok:false,latencyMs:Date.now()-t,error:e.message}}}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!(await requireAuth(req,res))) return;
  if(req.method!=='GET') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  const db=await timed('database',async()=>{const sql=getDb();const r=await sql`SELECT now() AS now`;return r[0]?.now});
  let integrations=[]; let recentSync=[]; let recentActivity=[];
  if(db.ok){const sql=getDb();[integrations,recentSync,recentActivity]=await Promise.all([
    sql`SELECT provider,account_key,account_email,status,last_error,updated_at FROM brain_integrations ORDER BY provider,account_key`,
    sql`SELECT source,account,status,started_at,finished_at,items_seen,items_changed,error FROM brain_sync_runs ORDER BY started_at DESC LIMIT 20`,
    sql`SELECT id,area,kind,title,source_type,occurred_at,payload FROM brain_activity ORDER BY occurred_at DESC LIMIT 30`
  ]);}
  const failingIntegrations=integrations.filter(x=>x.status!=='connected'||x.last_error);
  const status=!db.ok?'PROBLEM':failingIntegrations.length?'ATTENTION':'HEALTHY';
  return res.status(200).json({status,generatedAt:new Date().toISOString(),checks:{database:db},integrations,recentSync,recentActivity,metrics:{integrationCount:integrations.length,failingIntegrations:failingIntegrations.length}});
}

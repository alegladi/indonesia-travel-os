import crypto from 'node:crypto';
import { getDb } from '../lib/brain-db.js';
import { brainLog } from '../lib/brain-log.js';
import { securityResponseHeaders } from '../lib/brain-security.js';

function safeEqual(a='',b=''){
  const aa=Buffer.from(String(a));
  const bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function authorized(req){
  const expected=process.env.BRAIN_WATCHDOG_TOKEN||process.env.CRON_SECRET;
  const auth=String(req.headers?.authorization||'');
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  return Boolean(expected && expected.length>=32) && safeEqual(supplied,expected);
}

export default async function handler(req,res){
  securityResponseHeaders(res);
  if(req.method!=='GET' && req.method!=='POST') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!authorized(req)) return res.status(401).json({error:'UNAUTHORIZED'});
  const started=Date.now();
  try{
    const sql=getDb();
    await sql`SELECT 1`;
    const stale=await sql`SELECT count(*)::int AS n FROM brain_integrations WHERE status<>'connected' OR last_error IS NOT NULL OR updated_at < now()-interval '24 hours'`;
    const running=await sql`SELECT count(*)::int AS n FROM brain_sync_runs WHERE status='running' AND started_at < now()-interval '15 minutes'`;
    const staleCount=Number(stale[0]?.n||0);
    const stuckCount=Number(running[0]?.n||0);
    const severity=staleCount||stuckCount?'attention':'healthy';
    await brainLog({kind:'HEALTH',title:`Watchdog ${severity}`,payload:{staleIntegrations:staleCount,stuckSyncs:stuckCount,latencyMs:Date.now()-started}});
    return res.status(200).json({ok:true,severity,staleIntegrations:staleCount,stuckSyncs:stuckCount,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()});
  }catch(error){
    console.error('watchdog failure',error);
    try{await brainLog({kind:'INCIDENT',title:'Watchdog failure',payload:{}})}catch{}
    return res.status(503).json({ok:false,severity:'problem',checkedAt:new Date().toISOString()});
  }
}

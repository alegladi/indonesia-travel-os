import { getDb } from '../lib/brain-db.js';
import { brainLog } from '../lib/brain-log.js';

function authorized(req){const expected=process.env.BRAIN_WATCHDOG_TOKEN||process.env.CRON_SECRET;const auth=req.headers?.authorization||'';return Boolean(expected)&&auth===`Bearer ${expected}`}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!authorized(req)) return res.status(401).json({error:'UNAUTHORIZED'});
  const started=Date.now();
  try{
    const sql=getDb();
    const db=await sql`SELECT now() AS now`;
    const stale=await sql`SELECT provider,account_key,status,last_error,updated_at FROM brain_integrations WHERE status<>'connected' OR last_error IS NOT NULL OR updated_at < now()-interval '24 hours'`;
    const running=await sql`SELECT id,source,account,started_at FROM brain_sync_runs WHERE status='running' AND started_at < now()-interval '15 minutes'`;
    const severity=stale.length||running.length?'attention':'healthy';
    await brainLog({kind:'HEALTH',title:`Watchdog ${severity}`,payload:{staleIntegrations:stale.length,stuckSyncs:running.length,latencyMs:Date.now()-started}});
    return res.status(200).json({ok:true,severity,database:Boolean(db[0]),staleIntegrations:stale,stuckSyncs:running,latencyMs:Date.now()-started,checkedAt:new Date().toISOString()});
  }catch(error){console.error('watchdog',error);await brainLog({kind:'INCIDENT',title:'Watchdog failure',payload:{error:error.message}});return res.status(503).json({ok:false,severity:'problem',error:error.message,checkedAt:new Date().toISOString()})}
}

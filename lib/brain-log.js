import { getDb } from './brain-db.js';

export async function brainLog({area='ALEGLADI',kind,title,sourceType='system',sourceId=null,payload={}}){
  try{const sql=getDb();await sql`INSERT INTO brain_activity(area,kind,title,source_type,source_id,payload) VALUES(${area},${kind},${title},${sourceType},${sourceId},${payload})`;return true}catch(error){console.error('brainLog',error);return false}
}

export async function syncStart(source,account=null){const sql=getDb();const r=await sql`INSERT INTO brain_sync_runs(source,account,status) VALUES(${source},${account},'running') RETURNING id`;return r[0]?.id}
export async function syncFinish(id,{status='ok',itemsSeen=0,itemsChanged=0,error=null}={}){const sql=getDb();await sql`UPDATE brain_sync_runs SET status=${status},finished_at=now(),items_seen=${itemsSeen},items_changed=${itemsChanged},error=${error} WHERE id=${id}`}

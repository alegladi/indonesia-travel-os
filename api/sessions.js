import { getDb } from '../lib/brain-db.js';
import { requireSession, revokeSessionById } from '../lib/brain-session.js';
import { requireSameOrigin, securityResponseHeaders } from '../lib/brain-security.js';

export default async function handler(req,res){
  securityResponseHeaders(res);
  const session=await requireSession(req,res);
  if(!session) return;
  if(!requireSameOrigin(req,res)) return;
  try{
    const sql=getDb();
    if(req.method==='GET'){
      const rows=await sql`SELECT id,auth_method,user_email,device_label,user_agent,created_at,last_seen_at,expires_at,revoked_at
        FROM brain_sessions
        WHERE revoked_at IS NULL AND expires_at>now()
        ORDER BY last_seen_at DESC`;
      return res.status(200).json({currentSessionId:session.id,sessions:rows});
    }
    if(req.method==='DELETE'){
      const id=req.body?.id;
      if(!id) return res.status(400).json({error:'SESSION_ID_REQUIRED'});
      if(String(id)===String(session.id)) return res.status(400).json({error:'USE_LOGOUT_FOR_CURRENT_SESSION'});
      await revokeSessionById(id);
      return res.status(200).json({ok:true});
    }
    return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  }catch(error){
    console.error('sessions api',error?.message||error);
    return res.status(503).json({error:'SESSIONS_UNAVAILABLE'});
  }
}

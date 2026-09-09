import crypto from 'node:crypto';
import { getDb } from './brain-db.js';

const COOKIE_NAME='alegladi_brain_session_v2';
const MAX_AGE_SECONDS=60*60*24*30;

function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
function parseCookies(req){
  const raw=req.headers?.cookie||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function cookie(token,maxAge=MAX_AGE_SECONDS){return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`}
function ipHash(req){
  const ip=String(req.headers?.['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim();
  const salt=process.env.BRAIN_IP_HASH_SALT||'';
  return ip?hash(`${salt}:${ip}`):null;
}

export async function createDeviceSession(req,{authMethod='google',userEmail=null,deviceLabel=null}={}){
  const token=crypto.randomBytes(48).toString('base64url');
  const tokenHash=hash(token);
  const expiresAt=new Date(Date.now()+MAX_AGE_SECONDS*1000);
  const ua=String(req.headers?.['user-agent']||'').slice(0,1000);
  const sql=getDb();
  await sql`INSERT INTO brain_sessions(token_hash,auth_method,user_email,device_label,user_agent,ip_hash,expires_at)
    VALUES(${tokenHash},${authMethod},${userEmail},${deviceLabel},${ua},${ipHash(req)},${expiresAt})`;
  return cookie(token);
}

export async function getSession(req,{touch=true}={}){
  const token=parseCookies(req)[COOKIE_NAME];
  if(!token) return null;
  const sql=getDb();
  const rows=await sql`SELECT id,auth_method,user_email,device_label,user_agent,created_at,last_seen_at,expires_at,revoked_at
    FROM brain_sessions WHERE token_hash=${hash(token)} LIMIT 1`;
  const row=rows[0];
  if(!row||row.revoked_at||new Date(row.expires_at).getTime()<=Date.now()) return null;
  if(touch && (!row.last_seen_at || Date.now()-new Date(row.last_seen_at).getTime()>5*60*1000)) {
    await sql`UPDATE brain_sessions SET last_seen_at=now() WHERE id=${row.id}`;
  }
  return row;
}

export async function requireSession(req,res){
  try{
    const session=await getSession(req);
    if(session) return session;
  }catch(error){
    console.error('session check',error);
  }
  res.status(401).json({error:'UNAUTHORIZED'});
  return null;
}

export async function revokeCurrentSession(req){
  const token=parseCookies(req)[COOKIE_NAME];
  if(!token) return;
  const sql=getDb();
  await sql`UPDATE brain_sessions SET revoked_at=now() WHERE token_hash=${hash(token)} AND revoked_at IS NULL`;
}

export async function revokeSessionById(id){
  const sql=getDb();
  await sql`UPDATE brain_sessions SET revoked_at=now() WHERE id=${id} AND revoked_at IS NULL`;
}

export function clearDeviceSessionCookie(){return cookie('',0)}

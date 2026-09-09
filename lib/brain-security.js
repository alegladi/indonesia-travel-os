import crypto from 'node:crypto';
import { getDb } from './brain-db.js';

const SAFE_METHODS = new Set(['GET','HEAD','OPTIONS']);
const LOGIN_MAX_FAILURES = 5;
const LOGIN_HARD_MAX_FAILURES = 20;
const PREAUTH_COOKIE='__Host-brain_preauth';
const PREAUTH_TTL_SECONDS=300;

function hash(value){return crypto.createHash('sha256').update(String(value)).digest('hex')}
function safeEqual(a='',b=''){
  const aa=Buffer.from(String(a));
  const bb=Buffer.from(String(b));
  return aa.length===bb.length && crypto.timingSafeEqual(aa,bb);
}
function parseCookies(req){
  const raw=req.headers?.cookie||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function clientIp(req){
  return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim().slice(0,200);
}
function clientKey(req){
  const salt=process.env.BRAIN_IP_HASH_SALT;
  if(!salt || salt.length<16) throw new Error('BRAIN_IP_HASH_SALT_NOT_CONFIGURED');
  const ua=String(req.headers?.['user-agent']||'').slice(0,500);
  return hash(`${salt}:${clientIp(req)}:${ua}`);
}
function expectedOrigin(){
  const raw=process.env.BRAIN_BASE_URL;
  if(!raw) throw new Error('BRAIN_BASE_URL_NOT_CONFIGURED');
  return new URL(raw).origin;
}
function preauthSecret(){
  const value=process.env.BRAIN_PREAUTH_SECRET;
  if(!value || value.length<32) throw new Error('BRAIN_PREAUTH_SECRET_NOT_CONFIGURED');
  return value;
}
function signPreauth(payload){return crypto.createHmac('sha256',preauthSecret()).update(payload).digest('base64url')}

export function requireSameOrigin(req,res){
  if(SAFE_METHODS.has(String(req.method||'GET').toUpperCase())) return true;
  try{
    const origin=req.headers?.origin;
    const referer=req.headers?.referer;
    const expected=expectedOrigin();
    if(origin && new URL(origin).origin===expected) return true;
    if(!origin && referer && new URL(referer).origin===expected) return true;
  }catch{}
  res.status(403).json({error:'FORBIDDEN_ORIGIN'});
  return false;
}

export function createPreauthCookie(req){
  const exp=Math.floor(Date.now()/1000)+PREAUTH_TTL_SECONDS;
  const nonce=crypto.randomBytes(24).toString('base64url');
  const fp=clientKey(req);
  const payload=`${exp}.${nonce}.${fp}`;
  const value=`${payload}.${signPreauth(payload)}`;
  return `${PREAUTH_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${PREAUTH_TTL_SECONDS}`;
}
export function clearPreauthCookie(){return `${PREAUTH_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
export function verifyPreauth(req){
  try{
    const value=parseCookies(req)[PREAUTH_COOKIE];
    if(!value) return false;
    const parts=value.split('.');
    if(parts.length!==4) return false;
    const [expRaw,nonce,fp,sig]=parts;
    const exp=Number(expRaw);
    if(!Number.isFinite(exp) || exp<Math.floor(Date.now()/1000)) return false;
    if(!safeEqual(fp,clientKey(req))) return false;
    return safeEqual(sig,signPreauth(`${expRaw}.${nonce}.${fp}`));
  }catch{return false;}
}

export async function assertLoginAllowed(req){
  const sql=getDb();
  const key=clientKey(req);
  const recent=await sql`SELECT count(*)::int AS n FROM brain_system_events WHERE component='auth' AND kind='login_failed' AND detail=${key} AND created_at > now() - interval '15 minutes'`;
  if(Number(recent[0]?.n||0)>=LOGIN_MAX_FAILURES){const err=new Error('LOGIN_RATE_LIMITED');err.statusCode=429;throw err;}
  const hard=await sql`SELECT count(*)::int AS n FROM brain_system_events WHERE component='auth' AND kind='login_failed' AND detail=${key} AND created_at > now() - interval '24 hours'`;
  if(Number(hard[0]?.n||0)>=LOGIN_HARD_MAX_FAILURES){const err=new Error('LOGIN_RATE_LIMITED');err.statusCode=429;throw err;}
  return key;
}

export async function recordAuthEvent(req,kind,title,severity='info'){
  try{
    const sql=getDb();
    const key=clientKey(req);
    await sql`INSERT INTO brain_system_events(component,kind,severity,title,detail,actor) VALUES('auth',${kind},${severity},${title},${key},'security')`;
  }catch(error){console.error('auth audit event failed',error?.message||error);}
}

export function securityResponseHeaders(res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
}

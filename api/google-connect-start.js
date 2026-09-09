import crypto from 'node:crypto';
import { requireSession } from '../lib/brain-session.js';
import { securityResponseHeaders } from '../lib/brain-security.js';

const ACCOUNTS=new Set(['personal','arredo_service']);
const SCOPES=['openid','email','profile','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/drive.readonly'];
function b64url(buf){return Buffer.from(buf).toString('base64url')}
function cookie(name,value,maxAge=600){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}

export default async function handler(req,res){
  securityResponseHeaders(res);
  if(req.method!=='GET') return res.status(405).end();
  if(!await requireSession(req,res)) return;
  const account=String(req.query?.account||'');
  if(!ACCOUNTS.has(account)) return res.status(400).json({error:'INVALID_ACCOUNT'});
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const base=(process.env.BRAIN_BASE_URL||'').replace(/\/$/,'');
  if(!clientId||!base) return res.status(503).json({error:'GOOGLE_AUTH_NOT_CONFIGURED'});
  const verifier=b64url(crypto.randomBytes(48));
  const challenge=b64url(crypto.createHash('sha256').update(verifier).digest());
  const state=b64url(crypto.randomBytes(24));
  res.setHeader('Set-Cookie',[
    cookie('__Host-brain_google_verifier',verifier),
    cookie('__Host-brain_google_state',state),
    cookie('__Host-brain_google_account',account)
  ]);
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',clientId);
  u.searchParams.set('redirect_uri',`${base}/api/google-connect-callback`);
  u.searchParams.set('response_type','code');
  u.searchParams.set('scope',SCOPES.join(' '));
  u.searchParams.set('state',state);
  u.searchParams.set('code_challenge',challenge);
  u.searchParams.set('code_challenge_method','S256');
  u.searchParams.set('access_type','offline');
  u.searchParams.set('prompt','consent select_account');
  u.searchParams.set('include_granted_scopes','true');
  return res.redirect(302,u.toString());
}

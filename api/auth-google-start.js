import crypto from 'node:crypto';

function b64url(buf){return Buffer.from(buf).toString('base64url')}
function cookie(name,value,maxAge=600){return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).end();
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const base=(process.env.BRAIN_BASE_URL||'').replace(/\/$/,'');
  if(!clientId||!base) return res.status(503).json({error:'GOOGLE_AUTH_NOT_CONFIGURED'});
  const verifier=b64url(crypto.randomBytes(48));
  const challenge=b64url(crypto.createHash('sha256').update(verifier).digest());
  const state=b64url(crypto.randomBytes(24));
  res.setHeader('Set-Cookie',[cookie('brain_oauth_verifier',verifier),cookie('brain_oauth_state',state)]);
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id',clientId);
  u.searchParams.set('redirect_uri',`${base}/api/auth-google-callback`);
  u.searchParams.set('response_type','code');
  u.searchParams.set('scope','openid email profile');
  u.searchParams.set('state',state);
  u.searchParams.set('code_challenge',challenge);
  u.searchParams.set('code_challenge_method','S256');
  u.searchParams.set('prompt','select_account');
  u.searchParams.set('access_type','online');
  return res.redirect(302,u.toString());
}

import { createDeviceSession } from '../lib/brain-session.js';
import { verifyPreauth, clearPreauthCookie, recordAuthEvent, securityResponseHeaders } from '../lib/brain-security.js';

function cookies(req){
  const raw=req.headers?.cookie||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function clear(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}

export default async function handler(req,res){
  securityResponseHeaders(res);
  if(req.method!=='GET') return res.status(405).end();
  if(!verifyPreauth(req)) return res.status(401).send('Sessione password scaduta. Ripeti l’accesso.');
  const {code,state}=req.query||{};
  const c=cookies(req);
  const oauthState=c['__Host-brain_oauth_state'];
  const verifier=c['__Host-brain_oauth_verifier'];
  if(!code||!state||!oauthState||state!==oauthState||!verifier) return res.status(400).send('OAuth non valido.');
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const allowed=(process.env.BRAIN_ALLOWED_EMAIL||'').trim().toLowerCase();
  const base=(process.env.BRAIN_BASE_URL||'').replace(/\/$/,'');
  if(!clientId||!clientSecret||!allowed||!base) return res.status(503).send('Google login non configurato.');
  try{
    const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:String(code),code_verifier:verifier,grant_type:'authorization_code',redirect_uri:`${base}/api/auth-google-callback`});
    const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
    if(!tokenRes.ok){await recordAuthEvent(req,'mfa_failed','Google MFA token exchange failed','warning');return res.status(401).send('Autenticazione Google fallita.');}
    const token=await tokenRes.json();
    const userRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:`Bearer ${token.access_token}`}});
    if(!userRes.ok){await recordAuthEvent(req,'mfa_failed','Google MFA user verification failed','warning');return res.status(401).send('Impossibile verificare l’account Google.');}
    const user=await userRes.json();
    const email=String(user.email||'').toLowerCase();
    if(!user.email_verified||email!==allowed){await recordAuthEvent(req,'mfa_denied','Unauthorized Google account','warning');return res.status(403).send('Account non autorizzato.');}
    const sessionCookie=await createDeviceSession(req,{authMethod:'password+google',userEmail:email});
    await recordAuthEvent(req,'login_success','Password and Google MFA login succeeded','info');
    res.setHeader('Set-Cookie',[sessionCookie,clearPreauthCookie(),clear('__Host-brain_oauth_state'),clear('__Host-brain_oauth_verifier')]);
    return res.redirect(302,'/brain/index.html');
  }catch(error){
    console.error('google MFA callback',error);
    return res.status(503).send('Autenticazione temporaneamente non disponibile.');
  }
}

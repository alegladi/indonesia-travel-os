import { createDeviceSession } from '../lib/brain-session.js';

function cookies(req){
  const raw=req.headers?.cookie||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function clear(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}

export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).end();
  const {code,state}=req.query||{};
  const c=cookies(req);
  if(!code||!state||!c.brain_oauth_state||state!==c.brain_oauth_state||!c.brain_oauth_verifier) return res.status(400).send('OAuth non valido.');
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const allowed=(process.env.BRAIN_ALLOWED_EMAIL||'').trim().toLowerCase();
  const base=(process.env.BRAIN_BASE_URL||'').replace(/\/$/,'');
  if(!clientId||!clientSecret||!allowed||!base) return res.status(503).send('Google login non configurato.');
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:String(code),code_verifier:c.brain_oauth_verifier,grant_type:'authorization_code',redirect_uri:`${base}/api/auth-google-callback`});
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!tokenRes.ok) return res.status(401).send('Autenticazione Google fallita.');
  const token=await tokenRes.json();
  const userRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:`Bearer ${token.access_token}`}});
  if(!userRes.ok) return res.status(401).send('Impossibile verificare l’account Google.');
  const user=await userRes.json();
  const email=String(user.email||'').toLowerCase();
  if(!user.email_verified||email!==allowed) return res.status(403).send('Account non autorizzato.');
  try{
    const sessionCookie=await createDeviceSession(req,{authMethod:'google',userEmail:email});
    res.setHeader('Set-Cookie',[sessionCookie,clear('brain_oauth_state'),clear('brain_oauth_verifier')]);
    return res.redirect(302,'/brain/');
  }catch(error){
    console.error('google session create',error);
    return res.status(503).send('Database Brain non disponibile.');
  }
}

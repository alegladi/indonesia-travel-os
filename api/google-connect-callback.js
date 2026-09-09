import { getDb } from '../lib/brain-db.js';
import { encryptSecret } from '../lib/token-vault.js';
import { requireSession } from '../lib/brain-session.js';

function cookies(req){
  const raw=req.headers?.cookie||'';
  return Object.fromEntries(raw.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return [decodeURIComponent(x.slice(0,i)),decodeURIComponent(x.slice(i+1))]}));
}
function clear(name){return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`}
function expectedEmail(account){
  if(account==='personal') return String(process.env.BRAIN_GOOGLE_PERSONAL_EMAIL||process.env.BRAIN_ALLOWED_EMAIL||'').trim().toLowerCase();
  if(account==='arredo_service') return String(process.env.BRAIN_GOOGLE_WORK_EMAIL||'').trim().toLowerCase();
  return '';
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).end();
  if(!await requireSession(req,res)) return;
  const c=cookies(req);
  const account=c.brain_google_account;
  const {code,state}=req.query||{};
  if(!code||!state||!account||!c.brain_google_state||state!==c.brain_google_state||!c.brain_google_verifier) return res.status(400).send('OAuth non valido.');
  const expected=expectedEmail(account);
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const base=(process.env.BRAIN_BASE_URL||'').replace(/\/$/,'');
  if(!expected||!clientId||!clientSecret||!base) return res.status(503).send('Integrazione Google non configurata.');
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,code:String(code),code_verifier:c.brain_google_verifier,grant_type:'authorization_code',redirect_uri:`${base}/api/google-connect-callback`});
  const tokenRes=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
  if(!tokenRes.ok) return res.status(401).send('Scambio token Google fallito.');
  const token=await tokenRes.json();
  const userRes=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{authorization:`Bearer ${token.access_token}`}});
  if(!userRes.ok) return res.status(401).send('Account Google non verificabile.');
  const user=await userRes.json();
  const email=String(user.email||'').toLowerCase();
  if(!user.email_verified||email!==expected) return res.status(403).send('Hai autorizzato un account Google diverso da quello previsto.');
  if(!token.refresh_token) return res.status(400).send('Google non ha restituito un refresh token. Riprova revocando prima il consenso dell’app.');
  const scopes=String(token.scope||'').split(' ').filter(Boolean);
  const expiresAt=new Date(Date.now()+(Number(token.expires_in||3600)*1000));
  try{
    const sql=getDb();
    await sql`INSERT INTO brain_integrations(provider,account_key,account_email,scopes,encrypted_refresh_token,encrypted_access_token,access_token_expires_at,status,last_error,updated_at)
      VALUES('google',${account},${email},${scopes},${encryptSecret(token.refresh_token)},${encryptSecret(token.access_token)},${expiresAt},'connected',NULL,now())
      ON CONFLICT(provider,account_key) DO UPDATE SET account_email=EXCLUDED.account_email,scopes=EXCLUDED.scopes,encrypted_refresh_token=EXCLUDED.encrypted_refresh_token,encrypted_access_token=EXCLUDED.encrypted_access_token,access_token_expires_at=EXCLUDED.access_token_expires_at,status='connected',last_error=NULL,updated_at=now()`;
  }catch(error){
    console.error('google-connect-callback db',error);
    return res.status(503).send('Database Brain non disponibile.');
  }
  res.setHeader('Set-Cookie',[clear('brain_google_state'),clear('brain_google_verifier'),clear('brain_google_account')]);
  return res.redirect(302,'/brain/?google=connected');
}

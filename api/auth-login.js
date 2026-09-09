import { verifyPassword } from '../lib/brain-auth.js';
import { assertLoginAllowed, recordAuthEvent, requireSameOrigin, securityResponseHeaders, createPreauthCookie } from '../lib/brain-security.js';

export default async function handler(req,res){
  securityResponseHeaders(res);
  if(req.method!=='POST') return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  if(!requireSameOrigin(req,res)) return;
  try{
    await assertLoginAllowed(req);
    const password=req.body?.password;
    if(!password || !verifyPassword(password)){
      await recordAuthEvent(req,'login_failed','Password login failed','warning');
      await new Promise(r=>setTimeout(r,500));
      return res.status(401).json({error:'INVALID_CREDENTIALS'});
    }
    await recordAuthEvent(req,'password_verified','Password verified, MFA required','info');
    res.setHeader('Set-Cookie',createPreauthCookie(req));
    return res.status(200).json({ok:true,mfaRequired:true,redirect:'/api/auth-google-start'});
  }catch(error){
    if(error?.message==='LOGIN_RATE_LIMITED'){
      await recordAuthEvent(req,'login_rate_limited','Login throttled','warning');
      res.setHeader('Retry-After','900');
      return res.status(429).json({error:'TOO_MANY_ATTEMPTS'});
    }
    console.error('brain auth login',error?.message||error);
    return res.status(503).json({error:'AUTH_UNAVAILABLE'});
  }
}

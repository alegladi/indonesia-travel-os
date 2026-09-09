import crypto from 'node:crypto';

function safeEqual(a='',b=''){
  const aa=Buffer.from(String(a)); const bb=Buffer.from(String(b));
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

export function requireAgent(req,res){
  const expected=process.env.BRAIN_AGENT_TOKEN;
  if(!expected||expected.length<32){res.status(503).json({error:'AGENT_AUTH_NOT_CONFIGURED'});return false;}
  const auth=String(req.headers?.authorization||'');
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!safeEqual(supplied,expected)){res.status(401).json({error:'UNAUTHORIZED'});return false;}
  return true;
}

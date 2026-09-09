import crypto from 'node:crypto';

function safeEqual(a='',b=''){
  const aa=Buffer.from(String(a));
  const bb=Buffer.from(String(b));
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

// Password verification only. Session creation/validation lives exclusively in brain-session.js.
export function verifyPassword(input){
  const expected=process.env.BRAIN_PASSWORD;
  if(!expected) throw new Error('BRAIN_PASSWORD_NOT_CONFIGURED');
  return safeEqual(input,expected);
}

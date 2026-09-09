import crypto from 'node:crypto';

function key(){
  const raw=process.env.BRAIN_TOKEN_ENCRYPTION_KEY||'';
  let buf;
  if(/^[0-9a-fA-F]{64}$/.test(raw)) buf=Buffer.from(raw,'hex');
  else {
    try{buf=Buffer.from(raw,'base64')}catch{buf=null}
  }
  if(!buf||buf.length!==32) throw new Error('BRAIN_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED');
  return buf;
}

export function encryptSecret(value){
  if(value==null||value==='') return null;
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key(),iv);
  const ciphertext=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  const tag=cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSecret(payload){
  if(!payload) return null;
  const [version,ivB64,tagB64,dataB64]=String(payload).split('.');
  if(version!=='v1'||!ivB64||!tagB64||!dataB64) throw new Error('INVALID_ENCRYPTED_SECRET');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(ivB64,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64,'base64url'));
  const clear=Buffer.concat([decipher.update(Buffer.from(dataB64,'base64url')),decipher.final()]);
  return clear.toString('utf8');
}

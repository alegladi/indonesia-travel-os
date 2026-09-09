import { clearDeviceSessionCookie, revokeCurrentSession } from '../lib/brain-session.js';
import { requireSameOrigin, securityResponseHeaders, recordAuthEvent } from '../lib/brain-security.js';

export default async function handler(req, res) {
  securityResponseHeaders(res);
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  if (!requireSameOrigin(req,res)) return;
  try {
    await revokeCurrentSession(req);
    await recordAuthEvent(req,'logout','Session logged out','info');
  } catch (error) {
    console.error('brain logout revoke', error?.message || error);
  }
  res.setHeader('Set-Cookie', clearDeviceSessionCookie());
  return res.status(200).json({ ok: true });
}

import { clearDeviceSessionCookie, revokeCurrentSession } from '../lib/brain-session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try { await revokeCurrentSession(req); } catch (error) { console.error('brain logout revoke', error); }
  res.setHeader('Set-Cookie', clearDeviceSessionCookie());
  return res.status(200).json({ ok: true });
}

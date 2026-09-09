import { createSessionCookie, verifyPassword } from '../lib/brain-auth.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const password = req.body?.password;
    if (!password || !verifyPassword(password)) {
      await new Promise(r => setTimeout(r, 250));
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    res.setHeader('Set-Cookie', createSessionCookie());
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('brain auth login', error);
    return res.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });
  }
}

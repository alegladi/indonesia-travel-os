import { verifyPassword } from '../lib/brain-auth.js';
import { createDeviceSession } from '../lib/brain-session.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const password = req.body?.password;
    if (!password || !verifyPassword(password)) {
      await new Promise(r => setTimeout(r, 300));
      return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
    const sessionCookie = await createDeviceSession(req, {
      authMethod: 'password-fallback',
      userEmail: process.env.BRAIN_ALLOWED_EMAIL || null
    });
    res.setHeader('Set-Cookie', sessionCookie);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('brain auth login', error);
    return res.status(503).json({ error: error?.message === 'DATABASE_NOT_CONFIGURED' ? 'DATABASE_NOT_CONFIGURED' : 'AUTH_NOT_CONFIGURED' });
  }
}

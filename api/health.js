import { neon } from '@neondatabase/serverless';

function envReady(name) { return Boolean(process.env[name]); }

async function databaseHealth() {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
  if (!url) return { configured: false, ok: false };
  try {
    const sql = neon(url);
    await sql`SELECT 1`;
    return { configured: true, ok: true };
  } catch (error) {
    return { configured: true, ok: false, error: error.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const db = await databaseHealth();
  const checks = {
    database: db,
    auth: {
      passwordConfigured: envReady('BRAIN_PASSWORD'),
      sessionSecretConfigured: Boolean(process.env.BRAIN_SESSION_SECRET && process.env.BRAIN_SESSION_SECRET.length >= 32)
    },
    google: {
      oauthClientConfigured: envReady('GOOGLE_CLIENT_ID') && envReady('GOOGLE_CLIENT_SECRET'),
      personalConfigured: envReady('GOOGLE_PERSONAL_REFRESH_TOKEN'),
      workConfigured: envReady('GOOGLE_WORK_REFRESH_TOKEN')
    }
  };
  const ok = db.ok && checks.auth.passwordConfigured && checks.auth.sessionSecretConfigured && checks.google.oauthClientConfigured && checks.google.personalConfigured;
  return res.status(ok ? 200 : 503).json({ ok, generatedAt: new Date().toISOString(), checks });
}

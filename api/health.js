import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;
  if (!url) return res.status(503).json({ ok: false });
  try {
    const sql = neon(url);
    await sql`SELECT 1`;
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false });
  }
}

import { neon } from '@neondatabase/serverless';

function getUrl() {
  return process.env.STORAGE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
}

async function db() {
  const url = getUrl();
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS travel_state (
    id text PRIMARY KEY,
    state jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  return sql;
}

export default async function handler(req, res) {
  try {
    const sql = await db();
    const id = 'indonesia-2026-alessandro-selena';
    if (req.method === 'GET') {
      const rows = await sql`SELECT state, updated_at FROM travel_state WHERE id=${id}`;
      return res.status(200).json({ state: rows[0]?.state || { overrides: {}, spent: 0, notes: [] }, updatedAt: rows[0]?.updated_at || null });
    }
    if (req.method === 'POST') {
      const state = req.body?.state;
      if (!state || typeof state !== 'object') return res.status(400).json({ error: 'Stato mancante.' });
      await sql`INSERT INTO travel_state (id, state, updated_at)
        VALUES (${id}, ${JSON.stringify(state)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET state=EXCLUDED.state, updated_at=now()`;
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('state api error', e);
    if (e?.message === 'DATABASE_NOT_CONFIGURED') return res.status(503).json({ error: 'Database non collegato.' });
    return res.status(500).json({ error: 'Errore memoria condivisa.' });
  }
}

import { requireAuth } from '../lib/brain-auth.js';
import { getDb } from '../lib/brain-db.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAuth(req, res)) return;
  try {
    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id,label,amount_cents,currency,direction,due_at,paid_at,recurring,recurrence_rule,source_type,source_id,confidence,notes,created_at,updated_at
        FROM brain_finance_entries
        WHERE paid_at IS NULL OR due_at >= now() - interval '30 days'
        ORDER BY due_at ASC NULLS LAST, created_at DESC
        LIMIT 300`;
      const upcoming = rows.filter(x => x.direction === 'expense' && !x.paid_at && x.due_at);
      const knownUpcomingCents = upcoming.reduce((sum, x) => sum + (Number(x.amount_cents) || 0), 0);
      return res.status(200).json({ entries: rows, knownUpcomingCents, generatedAt: new Date().toISOString() });
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      if (!body.label || !['income','expense'].includes(body.direction)) return res.status(400).json({ error: 'INVALID_FINANCE_ENTRY' });
      const rows = await sql`
        INSERT INTO brain_finance_entries
        (label,amount_cents,currency,direction,due_at,paid_at,recurring,recurrence_rule,source_type,source_id,confidence,notes)
        VALUES (
          ${body.label},${body.amountCents ?? null},${body.currency || 'EUR'},${body.direction},
          ${body.dueAt || null},${body.paidAt || null},${Boolean(body.recurring)},${body.recurrenceRule || null},
          ${body.sourceType || null},${body.sourceId || null},${body.confidence || 'verified'},${body.notes || null}
        ) RETURNING *`;
      return res.status(201).json({ entry: rows[0] });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    console.error('brain finance api', error);
    const status = error.message === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message });
  }
}

import { requireAuth } from '../lib/brain-auth.js';
import { getDb } from '../lib/brain-db.js';

const ALLOWED_AREAS = ['VITA PRIVATA','DA NIALTRI','ARREDO SERVICE','ALEGLADI'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireAuth(req, res)) return;
  try {
    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id,title,area,project,status,priority,due_at,owner,source_type,source_id,notes,created_at,updated_at
        FROM brain_tasks
        WHERE status NOT IN ('done','cancelled')
        ORDER BY priority ASC, due_at ASC NULLS LAST, created_at ASC
        LIMIT 250`;
      return res.status(200).json({ tasks: rows, generatedAt: new Date().toISOString() });
    }
    if (req.method === 'POST') {
      const { title, area, project = null, priority = 3, dueAt = null, owner = null, notes = null } = req.body || {};
      if (!title || !ALLOWED_AREAS.includes(area)) return res.status(400).json({ error: 'INVALID_TASK' });
      const rows = await sql`
        INSERT INTO brain_tasks (title,area,project,priority,due_at,owner,notes)
        VALUES (${title},${area},${project},${priority},${dueAt},${owner},${notes})
        RETURNING *`;
      return res.status(201).json({ task: rows[0] });
    }
    if (req.method === 'PATCH') {
      const { id, status, priority, dueAt, notes } = req.body || {};
      if (!id) return res.status(400).json({ error: 'TASK_ID_REQUIRED' });
      const rows = await sql`
        UPDATE brain_tasks SET
          status = COALESCE(${status}, status),
          priority = COALESCE(${priority}, priority),
          due_at = COALESCE(${dueAt}, due_at),
          notes = COALESCE(${notes}, notes),
          updated_at = now()
        WHERE id = ${id}
        RETURNING *`;
      if (!rows[0]) return res.status(404).json({ error: 'TASK_NOT_FOUND' });
      return res.status(200).json({ task: rows[0] });
    }
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    console.error('brain tasks api', error);
    const status = error.message === 'DATABASE_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({ error: error.message });
  }
}

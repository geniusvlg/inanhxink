import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/metadata
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT key, value FROM metadata ORDER BY key');
    const config: Record<string, string> = {};
    for (const row of result.rows) config[row.key] = row.value;
    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/metadata — bulk upsert { key: value, ... }
router.put('/', async (req: Request, res: Response) => {
  const updates = req.body as Record<string, string>;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    return res.status(400).json({ success: false, error: 'Body must be a { key: value } object' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(updates)) {
      await client.query(
        `INSERT INTO metadata (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Config updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

export default router;

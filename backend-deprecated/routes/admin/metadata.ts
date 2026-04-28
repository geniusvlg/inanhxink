import { Router, Request, Response } from 'express';
import { sendError } from '../../middleware/sendError';
import db from '../../config/database';

const router = Router();

// GET /api/admin/metadata — return all config as key/value object
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT key, value FROM metadata ORDER BY key');
    const config: Record<string, string> = {};
    for (const row of result.rows) config[row.key] = row.value;
    return res.json({ success: true, config });
  } catch (err) {
    return sendError(res, err);
  }
});

// PUT /api/admin/metadata — upsert all provided key/value pairs
router.put('/', async (req: Request, res: Response) => {
  try {
    const entries = Object.entries(req.body as Record<string, string>);
    if (entries.length === 0) return res.json({ success: true });
    for (const [key, value] of entries) {
      await db.query(
        `INSERT INTO metadata (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }
    return res.json({ success: true });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;

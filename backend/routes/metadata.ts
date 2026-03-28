import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/metadata — return all config as a key/value object
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT key, value FROM metadata');
    const config: Record<string, string> = {};
    for (const row of result.rows) {
      config[row.key] = row.value;
    }
    return res.json({ success: true, config });
  } catch (err) {
    console.error('Error fetching metadata:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
});

export default router;

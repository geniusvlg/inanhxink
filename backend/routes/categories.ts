import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/categories — public, returns all active categories
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM product_categories ORDER BY name');
    return res.json({ success: true, categories: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

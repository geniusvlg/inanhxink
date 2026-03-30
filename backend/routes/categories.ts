import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/categories?type= — public
// If `type` is provided, returns only categories linked to products of that type.
// Otherwise returns all categories.
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };

    let result;
    if (type) {
      result = await db.query(
        `SELECT id, name FROM product_categories WHERE type = $1 ORDER BY name`,
        [type]
      );
    } else {
      result = await db.query('SELECT id, name FROM product_categories ORDER BY name');
    }

    return res.json({ success: true, categories: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

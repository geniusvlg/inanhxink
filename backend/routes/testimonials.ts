import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/testimonials — public list, ordered by featured/sort/created
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, image_url, platform, reviewer_name, caption, is_featured
       FROM testimonials
       ORDER BY is_featured DESC, sort_order ASC, created_at DESC`,
    );
    return res.json({ success: true, testimonials: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

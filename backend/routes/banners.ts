import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/banners — public, returns active banners ordered for the carousel
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, image_url, link_url, alt_text
         FROM banners
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, created_at DESC`,
    );
    return res.json({ success: true, banners: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

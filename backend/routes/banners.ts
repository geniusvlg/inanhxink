import { Router, Request, Response } from 'express';
import db from '../config/database';
import { rewriteRowImageFields } from '../config/cdn';

const router = Router();

// GET /api/banners — public, returns active banners ordered for the carousel.
// image_url is rewritten from raw S3 to the public CDN.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, image_url, link_url, alt_text
         FROM banners
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, created_at DESC`,
    );
    const banners = result.rows.map(r => rewriteRowImageFields(r, { url: ['image_url'] }));
    return res.json({ success: true, banners });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

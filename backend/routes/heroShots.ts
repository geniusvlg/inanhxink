import { Router, Request, Response } from 'express';
import { sendError } from '../middleware/sendError';
import db from '../config/database';
import { rewriteRowImageFields } from '../config/cdn';

const router = Router();

// GET /api/hero-shots — public, returns the 3 hero polaroid slots ordered
// by slot (0, 1, 2). Slots without an image are still returned so the
// frontend can decide how to render fallbacks. image_url is rewritten
// from raw S3 to the public CDN.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT slot, image_url, caption
         FROM hero_shots
        ORDER BY slot ASC`,
    );
    const hero_shots = result.rows.map(r => rewriteRowImageFields(r, { url: ['image_url'] }));
    return res.json({ success: true, hero_shots });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;

import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/hero-shots — public, returns the 3 hero polaroid slots ordered
// by slot (0, 1, 2). Slots without an image are still returned so the
// frontend can decide how to render fallbacks.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT slot, image_url, caption
         FROM hero_shots
        ORDER BY slot ASC`,
    );
    return res.json({ success: true, hero_shots: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

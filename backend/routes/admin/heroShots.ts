import { Router, Request, Response } from 'express';
import db from '../../config/database';
import { deleteFromS3 } from '../../config/s3';

const router = Router();

// GET /api/admin/hero-shots — admin view of the 3 slots
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT slot, image_url, caption, updated_at
         FROM hero_shots
        ORDER BY slot ASC`,
    );
    return res.json({ success: true, hero_shots: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/hero-shots/:slot
// Body: { image_url?: string|null, caption?: string|null }
// Updates one slot in place. If image_url changes, the previous S3 file
// is removed (best-effort).
router.put('/:slot', async (req: Request, res: Response) => {
  const slot = Number(req.params.slot);
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) {
    return res.status(400).json({ success: false, error: 'slot must be 0, 1, or 2' });
  }

  const { image_url, caption } = req.body as {
    image_url?: string | null;
    caption?:   string | null;
  };

  const allowed: Record<string, unknown> = {};
  if (image_url !== undefined) allowed['image_url'] = image_url || null;
  if (caption   !== undefined) allowed['caption']   = caption?.trim() ? caption.trim() : null;

  if (Object.keys(allowed).length === 0) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  try {
    let previousImage: string | null = null;
    if (image_url !== undefined) {
      const before = await db.query('SELECT image_url FROM hero_shots WHERE slot = $1', [slot]);
      previousImage = before.rows[0]?.image_url ?? null;
    }

    const setClauses = Object.keys(allowed).map((k, i) => `${k} = $${i + 1}`);
    const values     = [...Object.values(allowed), slot];
    const result = await db.query(
      `UPDATE hero_shots SET ${setClauses.join(', ')}
        WHERE slot = $${values.length}
       RETURNING slot, image_url, caption, updated_at`,
      values,
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Slot not found' });
    }

    if (previousImage && previousImage !== (image_url || null)) {
      try { await deleteFromS3(previousImage); }
      catch (s3err) { console.warn('[hero_shots] S3 cleanup failed:', (s3err as Error).message); }
    }

    return res.json({ success: true, hero_shot: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

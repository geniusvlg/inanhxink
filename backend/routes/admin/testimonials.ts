import { Router, Request, Response } from 'express';
import db from '../../config/database';
import { deleteFromS3 } from '../../config/s3';

const router = Router();

const ALLOWED_PLATFORMS = new Set([
  'tiktok', 'zalo', 'instagram', 'other',
]);

function normalisePlatform(p: unknown): string {
  if (typeof p === 'string' && ALLOWED_PLATFORMS.has(p)) return p;
  return 'other';
}

// GET /api/admin/testimonials
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM testimonials
       ORDER BY is_featured DESC, sort_order ASC, created_at DESC`,
    );
    return res.json({ success: true, testimonials: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/testimonials
// Body: { image_url, platform?, reviewer_name?, caption?, is_featured?, is_featured_on_home? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { image_url, platform, reviewer_name, caption, is_featured, is_featured_on_home } = req.body as {
      image_url?: string;
      platform?: string;
      reviewer_name?: string | null;
      caption?: string | null;
      is_featured?: boolean;
      is_featured_on_home?: boolean;
    };
    if (!image_url) {
      return res.status(400).json({ success: false, error: 'image_url required' });
    }

    const nextOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM testimonials',
    );

    const result = await db.query(
      `INSERT INTO testimonials (image_url, platform, reviewer_name, caption, is_featured, is_featured_on_home, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        image_url,
        normalisePlatform(platform),
        reviewer_name ?? null,
        caption ?? null,
        is_featured ?? false,
        is_featured_on_home ?? false,
        nextOrder.rows[0].next,
      ],
    );
    return res.status(201).json({ success: true, testimonial: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/testimonials/bulk
// Body (preferred): { items: [{ image_url, platform?, reviewer_name?, caption?, is_featured? }, ...] }
// Body (legacy):    { image_urls: string[] }  — defaults each row to platform='other'
router.post('/bulk', async (req: Request, res: Response) => {
  type BulkItem = {
    image_url?: string;
    platform?: string;
    reviewer_name?: string | null;
    caption?: string | null;
    is_featured?: boolean;
    is_featured_on_home?: boolean;
  };

  const body = req.body as { items?: BulkItem[]; image_urls?: string[] };
  let items: BulkItem[] = [];
  if (Array.isArray(body.items) && body.items.length > 0) {
    items = body.items;
  } else if (Array.isArray(body.image_urls) && body.image_urls.length > 0) {
    items = body.image_urls.map(u => ({ image_url: u }));
  } else {
    return res.status(400).json({
      success: false,
      error: 'items (non-empty array) or image_urls required',
    });
  }

  for (const it of items) {
    if (!it.image_url || typeof it.image_url !== 'string') {
      return res.status(400).json({ success: false, error: 'each item requires image_url' });
    }
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const baseRow = await client.query(
      'SELECT COALESCE(MAX(sort_order), 0) AS base FROM testimonials',
    );
    let order = parseInt(baseRow.rows[0].base, 10);
    const inserted: unknown[] = [];
    for (const it of items) {
      order += 1;
      const r = await client.query(
        `INSERT INTO testimonials (image_url, platform, reviewer_name, caption, is_featured, is_featured_on_home, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          it.image_url,
          normalisePlatform(it.platform),
          it.reviewer_name?.trim() ? it.reviewer_name.trim() : null,
          it.caption?.trim()       ? it.caption.trim()       : null,
          Boolean(it.is_featured),
          Boolean(it.is_featured_on_home),
          order,
        ],
      );
      inserted.push(r.rows[0]);
    }
    await client.query('COMMIT');
    return res.status(201).json({ success: true, testimonials: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

// PUT /api/admin/testimonials/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { image_url, platform, reviewer_name, caption, is_featured, is_featured_on_home } = req.body as {
      image_url?: string;
      platform?: string;
      reviewer_name?: string | null;
      caption?: string | null;
      is_featured?: boolean;
      is_featured_on_home?: boolean;
    };

    const allowed: Record<string, unknown> = {};
    if (image_url           !== undefined) allowed['image_url']           = image_url;
    if (platform            !== undefined) allowed['platform']            = normalisePlatform(platform);
    if (reviewer_name       !== undefined) allowed['reviewer_name']       = reviewer_name ?? null;
    if (caption             !== undefined) allowed['caption']             = caption       ?? null;
    if (is_featured         !== undefined) allowed['is_featured']         = is_featured;
    if (is_featured_on_home !== undefined) allowed['is_featured_on_home'] = is_featured_on_home;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClauses = Object.keys(allowed).map((k, i) => `${k} = $${i + 1}`);
    const values     = [...Object.values(allowed), req.params.id];
    const result = await db.query(
      `UPDATE testimonials SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, testimonial: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/admin/testimonials/reorder
// Body: { items: [{ id, sort_order }, …] }
router.patch('/reorder', async (req: Request, res: Response) => {
  const { items } = req.body as { items?: { id: number; sort_order: number }[] };
  if (!Array.isArray(items)) {
    return res.status(400).json({ success: false, error: 'items array required' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      if (typeof it.id !== 'number' || typeof it.sort_order !== 'number') continue;
      await client.query(
        'UPDATE testimonials SET sort_order = $1 WHERE id = $2',
        [it.sort_order, it.id],
      );
    }
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/testimonials/:id — also removes the S3 image (best-effort)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'DELETE FROM testimonials WHERE id = $1 RETURNING id, image_url',
      [req.params.id],
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    const imageUrl = result.rows[0].image_url as string | null;
    if (imageUrl) {
      try { await deleteFromS3(imageUrl); }
      catch (s3err) { console.warn('[testimonials] S3 cleanup failed:', (s3err as Error).message); }
    }
    return res.json({ success: true, message: 'Testimonial deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

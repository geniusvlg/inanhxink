import { Router, Request, Response } from 'express';
import db from '../../config/database';
import { deleteFromS3 } from '../../config/s3';

const router = Router();

// GET /api/admin/banners
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT * FROM banners
        ORDER BY sort_order ASC, created_at DESC`,
    );
    return res.json({ success: true, banners: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/banners
// Body: { image_url, link_url?, alt_text?, is_active? }
router.post('/', async (req: Request, res: Response) => {
  try {
    const { image_url, link_url, alt_text, is_active } = req.body as {
      image_url?: string;
      link_url?: string | null;
      alt_text?: string | null;
      is_active?: boolean;
    };
    if (!image_url) {
      return res.status(400).json({ success: false, error: 'image_url required' });
    }

    const nextOrder = await db.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM banners',
    );

    const result = await db.query(
      `INSERT INTO banners (image_url, link_url, alt_text, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        image_url,
        link_url?.trim() ? link_url.trim() : null,
        alt_text?.trim() ? alt_text.trim() : null,
        is_active ?? true,
        nextOrder.rows[0].next,
      ],
    );
    return res.status(201).json({ success: true, banner: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/banners/:id  — partial update; if image_url changes, the
// previous file is removed from S3.
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { image_url, link_url, alt_text, is_active } = req.body as {
      image_url?: string;
      link_url?: string | null;
      alt_text?: string | null;
      is_active?: boolean;
    };

    const allowed: Record<string, unknown> = {};
    if (image_url !== undefined) allowed['image_url'] = image_url;
    if (link_url  !== undefined) allowed['link_url']  = link_url?.trim() ? link_url.trim() : null;
    if (alt_text  !== undefined) allowed['alt_text']  = alt_text?.trim() ? alt_text.trim() : null;
    if (is_active !== undefined) allowed['is_active'] = is_active;

    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    let previousImage: string | null = null;
    if (image_url !== undefined) {
      const before = await db.query('SELECT image_url FROM banners WHERE id = $1', [req.params.id]);
      previousImage = before.rows[0]?.image_url ?? null;
    }

    const setClauses = Object.keys(allowed).map((k, i) => `${k} = $${i + 1}`);
    const values     = [...Object.values(allowed), req.params.id];
    const result = await db.query(
      `UPDATE banners SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    if (previousImage && previousImage !== image_url) {
      try { await deleteFromS3(previousImage); }
      catch (s3err) { console.warn('[banners] S3 cleanup failed:', (s3err as Error).message); }
    }

    return res.json({ success: true, banner: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/admin/banners/reorder
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
        'UPDATE banners SET sort_order = $1 WHERE id = $2',
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

// DELETE /api/admin/banners/:id  — also removes the S3 image (best-effort)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'DELETE FROM banners WHERE id = $1 RETURNING id, image_url',
      [req.params.id],
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });

    const imageUrl = result.rows[0].image_url as string | null;
    if (imageUrl) {
      try { await deleteFromS3(imageUrl); }
      catch (s3err) { console.warn('[banners] S3 cleanup failed:', (s3err as Error).message); }
    }
    return res.json({ success: true, message: 'Banner deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

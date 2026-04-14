import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/products?type=thiep|khung_anh&page=1&limit=20
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (type) { conditions.push(`p.type = $${idx++}`); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total FROM products p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    const result = await db.query(
      `SELECT p.*,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       ${where}
       GROUP BY p.id
       ORDER BY p.updated_at DESC, p.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    return res.json({ success: true, products: result.rows, total, page, limit });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/admin/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT p.*,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       WHERE p.id = $1
       GROUP BY p.id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/products
router.post('/', async (req: Request, res: Response) => {
  const { name, description, price, images = [], type, is_active = true, is_best_seller = false, watermark_enabled = false, tiktok_url, instagram_url, category_ids = [], discount_price, discount_from, discount_to } =
    req.body as {
      name: string; description?: string; price: number;
      images?: string[]; type: string; is_active?: boolean; is_best_seller?: boolean; watermark_enabled?: boolean;
      tiktok_url?: string; instagram_url?: string; category_ids?: number[];
      discount_price?: number | null; discount_from?: string | null; discount_to?: string | null;
    };

  if (!name || price == null || !type) {
    return res.status(400).json({ success: false, error: 'name, price, type required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const insert = await client.query(
      `INSERT INTO products (name, description, price, images, type, is_active, is_best_seller, watermark_enabled, tiktok_url, instagram_url, discount_price, discount_from, discount_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [name, description ?? null, price, JSON.stringify(images), type, is_active, is_best_seller, watermark_enabled, tiktok_url ?? null, instagram_url ?? null, discount_price ?? null, discount_from ?? null, discount_to ?? null]
    );
    const product = insert.rows[0];

    for (const catId of category_ids) {
      await client.query(
        `INSERT INTO product_category_map (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [product.id, catId]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ success: true, product });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

// PUT /api/admin/products/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, price, images, is_active, is_best_seller, watermark_enabled, tiktok_url, instagram_url, category_ids, discount_price, discount_from, discount_to } =
    req.body as {
      name?: string; description?: string; price?: number;
      images?: string[]; is_active?: boolean; is_best_seller?: boolean; watermark_enabled?: boolean;
      tiktok_url?: string | null; instagram_url?: string | null; category_ids?: number[];
      discount_price?: number | null; discount_from?: string | null; discount_to?: string | null;
    };

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const allowed: Record<string, unknown> = {};
    if (name        !== undefined) allowed['name']        = name;
    if (description !== undefined) allowed['description'] = description;
    if (price       !== undefined) allowed['price']       = price;
    if (images      !== undefined) allowed['images']      = JSON.stringify(images);
    if (is_active          !== undefined) allowed['is_active']          = is_active;
    if (is_best_seller     !== undefined) allowed['is_best_seller']     = is_best_seller;
    if (watermark_enabled  !== undefined) allowed['watermark_enabled']  = watermark_enabled;
    if (tiktok_url    !== undefined) allowed['tiktok_url']    = tiktok_url    ?? null;
    if (instagram_url !== undefined) allowed['instagram_url'] = instagram_url ?? null;
    if (discount_price !== undefined) allowed['discount_price'] = discount_price ?? null;
    if (discount_from  !== undefined) allowed['discount_from']  = discount_from  ?? null;
    if (discount_to    !== undefined) allowed['discount_to']    = discount_to    ?? null;

    if (Object.keys(allowed).length > 0) {
      const setClauses = Object.keys(allowed).map((k, i) => `${k} = $${i + 1}`);
      const values     = [...Object.values(allowed), req.params.id];
      await client.query(
        `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${values.length}`,
        values
      );
    }

    if (category_ids !== undefined) {
      await client.query('DELETE FROM product_category_map WHERE product_id = $1', [req.params.id]);
      for (const catId of category_ids) {
        await client.query(
          `INSERT INTO product_category_map (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [req.params.id, catId]
        );
      }
    }

    await client.query('COMMIT');
    const updated = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!updated.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, product: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/products/:id (hard delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

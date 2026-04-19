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

    const conditions: string[] = ['p.is_draft = false'];
    const params: unknown[] = [];
    let idx = 1;
    if (type) { conditions.push(`p.type = $${idx++}`); params.push(type); }
    const where = `WHERE ${conditions.join(' AND ')}`;

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

// GET /api/admin/products/featured-on-home
// Lists products currently featured on the public homepage, in their
// `home_sort_order`. Used by the dedicated admin reorder page.
//
// MUST be declared BEFORE `/:id` for the same reason as the public route.
router.get('/featured-on-home', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.price, p.images, p.type, p.is_active, p.is_draft,
              p.is_featured_on_home, p.home_sort_order,
              COALESCE(
                json_agg(json_build_object('id', pc.id, 'name', pc.name))
                FILTER (WHERE pc.id IS NOT NULL), '[]'
              ) AS categories
         FROM products p
         LEFT JOIN product_category_map m  ON m.product_id  = p.id
         LEFT JOIN product_categories   pc ON pc.id = m.category_id
        WHERE p.is_featured_on_home = TRUE
        GROUP BY p.id
        ORDER BY p.home_sort_order ASC, p.id ASC`
    );
    return res.json({ success: true, products: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/admin/products/featured-on-home/reorder
// Body: { items: { id: number; sort_order: number }[] }
// Replaces `home_sort_order` for the listed featured products in one txn.
router.patch('/featured-on-home/reorder', async (req: Request, res: Response) => {
  const { items } = req.body as { items?: { id: number; sort_order: number }[] };
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'items array required' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      if (typeof it.id !== 'number' || typeof it.sort_order !== 'number') continue;
      await client.query(
        'UPDATE products SET home_sort_order = $1 WHERE id = $2 AND is_featured_on_home = TRUE',
        [it.sort_order, it.id]
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

// POST /api/admin/products/check-name — check if a product name is already taken for a type
router.post('/check-name', async (req: Request, res: Response) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) {
    return res.status(400).json({ success: false, error: 'name and type are required' });
  }
  try {
    const result = await db.query(
      'SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND type = $2 AND is_draft = false LIMIT 1',
      [name.trim(), type]
    );
    if (result.rows.length > 0) {
      return res.json({ success: true, available: false, message: 'Tên sản phẩm đã tồn tại' });
    }
    return res.json({ success: true, available: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/products/reserve — create a draft product to obtain an ID for S3 uploads
// The draft is inactive and flagged; caller must PUT /:id to finalise or it will be cleaned up after 1 day
router.post('/reserve', async (req: Request, res: Response) => {
  const { name, type } = req.body as { name?: string; type?: string };
  if (!name || !type) {
    return res.status(400).json({ success: false, error: 'name and type are required' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const insert = await client.query(
      `INSERT INTO products (name, type, price, images, is_active, is_draft)
       VALUES ($1, $2, 0, '[]', false, true) RETURNING id`,
      [name.trim(), type]
    );
    await client.query('COMMIT');
    return res.status(201).json({ success: true, productId: insert.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ success: false, error: (err as Error).message });
  } finally {
    client.release();
  }
});

// POST /api/admin/products
router.post('/', async (req: Request, res: Response) => {
  const { name, description, price, images = [], type, is_active = true, is_best_seller = false, watermark_enabled = false, tiktok_url, instagram_url, category_ids = [], discount_price, discount_from, discount_to, is_featured_on_home = false } =
    req.body as {
      name: string; description?: string; price: number;
      images?: string[]; type: string; is_active?: boolean; is_best_seller?: boolean; watermark_enabled?: boolean;
      tiktok_url?: string; instagram_url?: string; category_ids?: number[];
      discount_price?: number | null; discount_from?: string | null; discount_to?: string | null;
      is_featured_on_home?: boolean;
    };

  if (!name || price == null || !type) {
    return res.status(400).json({ success: false, error: 'name, price, type required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // When featuring at creation time, give it the next available sort order
    // so it appears at the bottom of the homepage list (admin can re-order later).
    let homeSortOrder = 0;
    if (is_featured_on_home) {
      const max = await client.query(
        'SELECT COALESCE(MAX(home_sort_order), 0) AS max FROM products WHERE is_featured_on_home = TRUE'
      );
      homeSortOrder = Number(max.rows[0].max) + 1;
    }

    const insert = await client.query(
      `INSERT INTO products (name, description, price, images, type, is_active, is_best_seller, watermark_enabled, tiktok_url, instagram_url, discount_price, discount_from, discount_to, is_featured_on_home, home_sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [name, description ?? null, price, JSON.stringify(images), type, is_active, is_best_seller, watermark_enabled, tiktok_url ?? null, instagram_url ?? null, discount_price ?? null, discount_from ?? null, discount_to ?? null, is_featured_on_home, homeSortOrder]
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
  const { name, description, price, images, is_active, is_best_seller, watermark_enabled, tiktok_url, instagram_url, category_ids, discount_price, discount_from, discount_to, is_featured_on_home } =
    req.body as {
      name?: string; description?: string; price?: number;
      images?: string[]; is_active?: boolean; is_best_seller?: boolean; watermark_enabled?: boolean;
      tiktok_url?: string | null; instagram_url?: string | null; category_ids?: number[];
      discount_price?: number | null; discount_from?: string | null; discount_to?: string | null;
      is_featured_on_home?: boolean;
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

    // When toggling featured-on-home from off → on, append to the bottom of
    // the homepage order. When toggling off, leave the old sort_order behind
    // so re-enabling restores the previous position.
    if (is_featured_on_home !== undefined) {
      allowed['is_featured_on_home'] = is_featured_on_home;
      if (is_featured_on_home) {
        const cur = await client.query(
          'SELECT is_featured_on_home FROM products WHERE id = $1',
          [req.params.id]
        );
        const wasFeatured = cur.rows[0]?.is_featured_on_home === true;
        if (!wasFeatured) {
          const max = await client.query(
            'SELECT COALESCE(MAX(home_sort_order), 0) AS max FROM products WHERE is_featured_on_home = TRUE'
          );
          allowed['home_sort_order'] = Number(max.rows[0].max) + 1;
        }
      }
    }

    // Finalise a reserved draft when any real data is saved
    allowed['is_draft'] = false;

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

import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/products?type=thiep|khung_anh
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (type) { conditions.push(`p.type = $${idx++}`); params.push(type); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

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
       ORDER BY p.created_at DESC`,
      params
    );
    return res.json({ success: true, products: result.rows });
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
  const { name, description, price, images = [], type, is_active = true, category_ids = [] } =
    req.body as {
      name: string; description?: string; price: number;
      images?: string[]; type: string; is_active?: boolean; category_ids?: number[];
    };

  if (!name || price == null || !type) {
    return res.status(400).json({ success: false, error: 'name, price, type required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const insert = await client.query(
      `INSERT INTO products (name, description, price, images, type, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, description ?? null, price, JSON.stringify(images), type, is_active]
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
  const { name, description, price, images, is_active, category_ids } =
    req.body as {
      name?: string; description?: string; price?: number;
      images?: string[]; is_active?: boolean; category_ids?: number[];
    };

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const allowed: Record<string, unknown> = {};
    if (name        !== undefined) allowed['name']        = name;
    if (description !== undefined) allowed['description'] = description;
    if (price       !== undefined) allowed['price']       = price;
    if (images      !== undefined) allowed['images']      = JSON.stringify(images);
    if (is_active   !== undefined) allowed['is_active']   = is_active;

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

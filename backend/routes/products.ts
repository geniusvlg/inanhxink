import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/products?type=&category_ids=1,2&min_price=&max_price=&sort=newest|price_asc|price_desc
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, category_ids, min_price, max_price, sort } = req.query as Record<string, string | undefined>;

    const params: unknown[] = [];
    const conditions: string[] = ['p.is_active = true'];

    if (type) {
      params.push(type);
      conditions.push(`p.type = $${params.length}`);
    }
    if (min_price && !isNaN(Number(min_price))) {
      params.push(Number(min_price));
      conditions.push(`p.price >= $${params.length}`);
    }
    if (max_price && !isNaN(Number(max_price))) {
      params.push(Number(max_price));
      conditions.push(`p.price <= $${params.length}`);
    }
    if (category_ids) {
      const ids = category_ids.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        params.push(ids);
        conditions.push(
          `p.id IN (SELECT product_id FROM product_category_map WHERE category_id = ANY($${params.length}::int[]))`
        );
      }
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'ORDER BY p.updated_at DESC, p.created_at DESC';
    if (sort === 'price_asc')  orderBy = 'ORDER BY p.price ASC,  p.updated_at DESC, p.created_at DESC';
    if (sort === 'price_desc') orderBy = 'ORDER BY p.price DESC, p.updated_at DESC, p.created_at DESC';

    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_best_seller,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       ${where}
       GROUP BY p.id
       ${orderBy}`,
      params
    );
    return res.json({ success: true, products: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_active, p.is_best_seller, p.created_at,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       WHERE p.id = $1 AND p.is_active = true
       GROUP BY p.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

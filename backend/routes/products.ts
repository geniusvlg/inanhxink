import { Router, Request, Response } from 'express';
import db from '../config/database';

const router = Router();

// GET /api/products?type=thiep|khung_anh
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const params: unknown[] = [];
    let where = 'WHERE p.is_active = true';
    if (type) { where += ` AND p.type = $1`; params.push(type); }

    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
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

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_active, p.created_at,
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

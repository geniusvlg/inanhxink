import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/product-categories?type=thiep|khung_anh
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    const result = type
      ? await db.query('SELECT * FROM product_categories WHERE type = $1 ORDER BY name', [type])
      : await db.query('SELECT * FROM product_categories ORDER BY type, name');
    return res.json({ success: true, categories: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/product-categories
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type } = req.body as { name: string; type: string };
    if (!name || !type) return res.status(400).json({ success: false, error: 'name and type required' });
    const result = await db.query(
      'INSERT INTO product_categories (name, type) VALUES ($1,$2) RETURNING *',
      [name, type]
    );
    return res.status(201).json({ success: true, category: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/admin/product-categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'DELETE FROM product_categories WHERE id = $1 RETURNING id', [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

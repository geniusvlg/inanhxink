import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/templates — all templates (including inactive)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM templates ORDER BY id ASC');
    return res.json({ success: true, templates: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/admin/templates/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, template: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, image_url, price, template_type, is_active = true, demo_url } = req.body as {
      name: string; description?: string; image_url?: string;
      price: number; template_type: string; is_active?: boolean; demo_url?: string;
    };
    if (!name || !price || !template_type) {
      return res.status(400).json({ success: false, error: 'name, price, template_type required' });
    }
    const result = await db.query(
      `INSERT INTO templates (name, description, image_url, price, template_type, is_active, demo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, description ?? null, image_url ?? null, price, template_type, is_active, demo_url ?? null]
    );
    return res.status(201).json({ success: true, template: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const allowed = ['name', 'description', 'image_url', 'price', 'template_type', 'is_active', 'demo_url'];
    const fields = req.body as Record<string, unknown>;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const key of allowed) {
      if (key in fields) {
        setClauses.push(`${key} = $${i++}`);
        values.push(fields[key]);
      }
    }
    if (!setClauses.length) return res.status(400).json({ success: false, error: 'No valid fields to update' });
    values.push(req.params.id);
    const result = await db.query(
      `UPDATE templates SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, template: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/admin/templates/:id (soft-delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'UPDATE templates SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, message: 'Template deactivated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

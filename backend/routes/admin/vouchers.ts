import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

// GET /api/admin/vouchers
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT * FROM vouchers ORDER BY created_at DESC');
    return res.json({ success: true, vouchers: result.rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// POST /api/admin/vouchers
router.post('/', async (req: Request, res: Response) => {
  const { code, discount_type, discount_value, max_uses, expires_at, is_active } = req.body;
  if (!code || !discount_type || discount_value == null) {
    return res.status(400).json({ success: false, error: 'code, discount_type and discount_value are required' });
  }
  try {
    const result = await db.query(
      `INSERT INTO vouchers (code, discount_type, discount_value, max_uses, expires_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [code.toUpperCase(), discount_type, discount_value, max_uses ?? null, expires_at ?? null, is_active ?? true]
    );
    return res.json({ success: true, voucher: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/vouchers/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { discount_type, discount_value, max_uses, expires_at, is_active } = req.body;
  try {
    const result = await db.query(
      `UPDATE vouchers
       SET discount_type = $1, discount_value = $2, max_uses = $3, expires_at = $4, is_active = $5
       WHERE id = $6
       RETURNING *`,
      [discount_type, discount_value, max_uses ?? null, expires_at ?? null, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Voucher not found' });
    }
    return res.json({ success: true, voucher: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/admin/vouchers/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM vouchers WHERE id = $1', [id]);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

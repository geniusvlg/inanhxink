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
  try {
    const { code, discount_type, discount_value, max_uses, expires_at, is_active = true } = req.body as {
      code: string; discount_type: string; discount_value: number;
      max_uses?: number | null; expires_at?: string | null; is_active?: boolean;
    };
    if (!code || !discount_type || discount_value == null) {
      return res.status(400).json({ success: false, error: 'code, discount_type, discount_value required' });
    }
    const result = await db.query(
      `INSERT INTO vouchers (code, discount_type, discount_value, max_uses, expires_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [code.toUpperCase(), discount_type, discount_value, max_uses ?? null, expires_at ?? null, is_active]
    );
    return res.status(201).json({ success: true, voucher: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PUT /api/admin/vouchers/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { discount_type, discount_value, max_uses, expires_at, is_active } = req.body as {
      discount_type: string; discount_value: number;
      max_uses?: number | null; expires_at?: string | null; is_active?: boolean;
    };
    const result = await db.query(
      `UPDATE vouchers
       SET discount_type=$1, discount_value=$2, max_uses=$3, expires_at=$4, is_active=$5
       WHERE id=$6 RETURNING *`,
      [discount_type, discount_value, max_uses ?? null, expires_at ?? null, is_active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, voucher: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// DELETE /api/admin/vouchers/:id (soft-delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'UPDATE vouchers SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, message: 'Voucher deactivated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

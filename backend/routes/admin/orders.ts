import { Router, Request, Response } from 'express';
import db from '../../config/database';

const router = Router();

const DOMAIN = process.env.DOMAIN || 'inanhxink.com';

// GET /api/admin/orders?page=1&limit=20&payment_status=paid
router.get('/', async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (req.query.payment_status) {
      conditions.push(`o.payment_status = $${idx++}`);
      params.push(req.query.payment_status);
    }
    if (req.query.status) {
      conditions.push(`o.status = $${idx++}`);
      params.push(req.query.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const filterParams = [...params];

    params.push(limit, offset);
    const result = await db.query(
      `SELECT o.*, t.name AS template_name
       FROM orders o
       LEFT JOIN templates t ON t.id = o.template_id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${idx++} OFFSET $${idx}`,
      params
    );
    const countResult = await db.query(
      `SELECT COUNT(*) FROM orders o ${where}`,
      filterParams
    );
    return res.json({
      success: true,
      orders: result.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/admin/orders/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT o.*, t.name AS template_name, q.template_data
       FROM orders o
       LEFT JOIN templates t ON t.id = o.template_id
       LEFT JOIN qr_codes q ON q.qr_name = o.qr_name
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, order: result.rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// PATCH /api/admin/orders/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, payment_status } = req.body as { status?: string; payment_status?: string };
    const setClauses: string[] = [];
    const values: unknown[]    = [];
    let i = 1;
    if (status)         { setClauses.push(`status = $${i++}`);         values.push(status); }
    if (payment_status) { setClauses.push(`payment_status = $${i++}`); values.push(payment_status); }
    if (!setClauses.length) {
      return res.status(400).json({ success: false, error: 'status or payment_status required' });
    }

    await db.query('BEGIN');
    try {
      values.push(req.params.id);
      const result = await db.query(
        `UPDATE orders SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
        values
      );
      if (!result.rows.length) {
        await db.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      const order = result.rows[0];

      // If admin marks payment as paid manually, activate the QR code as well.
      if (order.payment_status === 'paid' && order.qr_name) {
        const qrName = String(order.qr_name).toLowerCase();
        const fullUrl = `${qrName}.${DOMAIN}`;
        const templateType = order.template_type || 'galaxy';
        const templateData = order.template_data ? JSON.stringify(order.template_data) : '{}';

        const qrResult = await db.query(
          `INSERT INTO qr_codes (qr_name, full_url, content, template_id, template_type, template_data)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (qr_name) DO UPDATE
             SET full_url      = EXCLUDED.full_url,
                 content       = EXCLUDED.content,
                 template_id   = EXCLUDED.template_id,
                 template_type = EXCLUDED.template_type,
                 template_data = EXCLUDED.template_data,
                 updated_at    = NOW()
           RETURNING id`,
          [qrName, fullUrl, order.content || '', order.template_id, templateType, templateData]
        );

        await db.query(
          'UPDATE orders SET qr_code_id = $1 WHERE id = $2',
          [qrResult.rows[0].id, order.id]
        );
      }

      await db.query('COMMIT');
      return res.json({ success: true, order });
    } catch (innerErr) {
      await db.query('ROLLBACK');
      throw innerErr;
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

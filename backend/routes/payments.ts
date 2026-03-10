import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

const DOMAIN = process.env.DOMAIN || 'inanhxink.com';
const SEPAY_API_KEY = process.env.SEPAY_API_KEY || '';
const SEPAY_ACCOUNT_NO = process.env.SEPAY_ACCOUNT_NO || '';
const SEPAY_BANK = process.env.SEPAY_BANK || 'MBBank';

// ── Create payment for an order ──────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body as { orderId: number };

    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required' });
    }

    const orderResult = await db.query(
      'SELECT id, total_amount, payment_status, qr_name FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.payment_status === 'paid') {
      return res.status(400).json({ success: false, error: 'Order is already paid' });
    }

    // Return existing pending payment if one exists
    const existingPayment = await db.query(
      'SELECT id, payment_qr_url FROM transactions WHERE order_id = $1 AND status = $2',
      [orderId, 'pending']
    );

    if (existingPayment.rows.length > 0) {
      const existing = existingPayment.rows[0];
      return res.json({
        success: true,
        payment: {
          id: existing.id,
          qrUrl: existing.payment_qr_url,
          amount: parseFloat(order.total_amount),
          paymentCode: `INXK${orderId}${order.qr_name.toUpperCase()}`,
        },
      });
    }

    const amount = Math.round(parseFloat(order.total_amount));
    const paymentCode = `INXK${orderId}${order.qr_name.toUpperCase()}`;

    const qrUrl = `https://qr.sepay.vn/img?acc=${encodeURIComponent(SEPAY_ACCOUNT_NO)}&bank=${encodeURIComponent(SEPAY_BANK)}&amount=${amount}&des=${encodeURIComponent(paymentCode)}&template=compact`;

    const paymentResult = await db.query(
      `INSERT INTO transactions (order_id, amount, status, payment_qr_url)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id, amount`,
      [orderId, amount, qrUrl]
    );

    const payment = paymentResult.rows[0];

    return res.json({
      success: true,
      payment: {
        id: payment.id,
        qrUrl,
        amount: parseFloat(payment.amount),
        paymentCode,
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error creating payment:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sepay webhook ────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'] || '';
    const expectedKey = `Apikey ${SEPAY_API_KEY}`;

    console.log('Webhook auth - received:', authHeader);
    console.log('Webhook auth - expected:', expectedKey);

    if (!SEPAY_API_KEY || authHeader !== expectedKey) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('Webhook payload:', JSON.stringify(req.body, null, 2));

    const webhookData = req.body as {
      id: number;
      content: string;
      transferType: string;
      transferAmount: number;
    };

    // Only process incoming transfers
    if (webhookData.transferType !== 'in') {
      return res.json({ success: true, message: 'Ignored: not an incoming transfer' });
    }

    // Parse order ID from content (e.g. "INXK9UYNUYN" or legacy "DH42")
    const match = webhookData.content?.match(/INXK(\d+)/i);
    if (!match) {
      console.warn('Webhook: could not parse order ID from content:', webhookData.content);
      return res.json({ success: true, message: 'No matching order code found in content' });
    }

    const orderId = parseInt(match[1], 10);

    // Find the pending transaction for this order
    const txResult = await db.query(
      'SELECT id, amount FROM transactions WHERE order_id = $1 AND status = $2',
      [orderId, 'pending']
    );

    if (txResult.rows.length === 0) {
      console.warn(`Webhook: no pending transaction for order ${orderId}`);
      return res.json({ success: true, message: 'No pending payment found' });
    }

    const tx = txResult.rows[0];

    // Reject underpayment
    const requiredAmount = parseFloat(tx.amount);
    if (webhookData.transferAmount < requiredAmount) {
      console.warn(`Webhook: underpayment for order ${orderId} — received ${webhookData.transferAmount}, required ${requiredAmount}`);
      return res.json({ success: true, message: 'Underpayment ignored' });
    }

    await db.query('BEGIN');
    try {
      // Mark transaction as paid
      await db.query(
        `UPDATE transactions
         SET status = 'paid',
             sepay_transaction_id = $1,
             paid_at = NOW(),
             updated_at = NOW(),
             webhook_payload = $2
         WHERE id = $3`,
        [webhookData.id, JSON.stringify(webhookData), tx.id]
      );

      // Update order payment_status
      await db.query(
        `UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1`,
        [orderId]
      );

      // Activate QR code
      const orderResult = await db.query(
        `SELECT qr_name, content, template_id, template_type, template_data
         FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        const qrName = order.qr_name;
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

        // Link qr_code back to order
        await db.query(
          'UPDATE orders SET qr_code_id = $1 WHERE id = $2',
          [qrResult.rows[0].id, orderId]
        );
      }

      await db.query('COMMIT');

      console.log(`Payment confirmed for order ${orderId}, transaction ${webhookData.id}`);
      return res.json({ success: true, message: 'Payment confirmed' });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    const err = error as Error;
    console.error('Webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get payment status by order ID ───────────────────────────────────────────
router.get('/order/:orderId', async (req: Request<{ orderId: string }>, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await db.query(
      `SELECT id, order_id, amount, status, payment_qr_url, paid_at, created_at
       FROM transactions WHERE order_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [parseInt(orderId, 10)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No payment found for this order' });
    }

    return res.json({ success: true, payment: result.rows[0] });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get payment info by qrName ───────────────────────────────────────────────
router.get('/qr/:qrName', async (req: Request<{ qrName: string }>, res: Response) => {
  try {
    const { qrName } = req.params;

    // Find the latest order for this qrName
    const orderResult = await db.query(
      `SELECT id, total_amount, payment_status, qr_name
       FROM orders WHERE qr_name = $1
       ORDER BY created_at DESC LIMIT 1`,
      [qrName.toLowerCase()]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    const fullUrl = `${order.qr_name}.${DOMAIN}`;

    // Find the latest transaction for this order
    const txResult = await db.query(
      `SELECT id, amount, status, payment_qr_url, paid_at, created_at
       FROM transactions WHERE order_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [order.id]
    );

    const payment = txResult.rows.length > 0 ? txResult.rows[0] : null;

    return res.json({
      success: true,
      order: {
        id: order.id,
        qrName: order.qr_name,
        fullUrl,
        totalAmount: parseFloat(order.total_amount),
        paymentStatus: order.payment_status,
      },
      payment: payment ? {
        id: payment.id,
        qrUrl: payment.payment_qr_url,
        amount: parseFloat(payment.amount),
        paymentCode: `INXK${order.id}${order.qr_name.toUpperCase()}`,
        status: payment.status,
      } : null,
    });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

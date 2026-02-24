import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

const DOMAIN = process.env.DOMAIN || 'inanhxink.com';

// Valid template types that we have cloned
const VALID_TEMPLATE_TYPES = ['galaxy', 'christmas', 'loveletter'] as const;
type TemplateType = typeof VALID_TEMPLATE_TYPES[number];

// Map the frontend template IDs to the template_type folder names
const TEMPLATE_TYPE_MAP: Record<string, TemplateType> = {
  letterinspace: 'galaxy',
  christmastree: 'christmas',
  loveletter: 'loveletter',
};

interface OrderTotal {
  subtotal: number;
  total: number;
  discount: number;
}

function calculateTotal(
  templatePrice: number | string,
  keychainPrice: number | string | null,
  musicPrice: number | string | null,
  tipAmount: number | string,
  voucherDiscount: number | null,
  discountType: string | null
): OrderTotal {
  let subtotal = parseFloat(String(templatePrice)) || 0;
  if (keychainPrice) subtotal += parseFloat(String(keychainPrice));
  if (musicPrice) subtotal += parseFloat(String(musicPrice));
  subtotal += parseFloat(String(tipAmount)) || 0;
  let total = subtotal;
  if (voucherDiscount) {
    if (discountType === 'percentage') {
      total = subtotal * (1 - voucherDiscount / 100);
    } else {
      total = Math.max(0, subtotal - voucherDiscount);
    }
  }
  return {
    subtotal: Math.round(subtotal),
    total: Math.round(total),
    discount: Math.round(subtotal - total),
  };
}

// ── Check if QR name / subdomain is available ────────────────────────────────
router.post('/check-qr-name', async (req: Request, res: Response) => {
  try {
    const { qrName } = req.body as { qrName: string };

    if (!qrName) {
      return res.status(400).json({ success: false, error: 'QR name is required' });
    }

    const validPattern = /^[a-z0-9_-]+$/;
    if (!validPattern.test(qrName)) {
      return res.status(400).json({
        success: false,
        error: 'QR name must be lowercase letters, numbers, dashes, or underscores only',
      });
    }

    const result = await db.query(
      'SELECT id FROM qr_codes WHERE qr_name = $1',
      [qrName.toLowerCase()]
    );

    if (result.rows.length > 0) {
      return res.json({ success: false, available: false, message: 'QR name already taken' });
    }

    return res.json({
      success: true,
      available: true,
      message: 'QR name is available',
      fullUrl: `${qrName.toLowerCase()}.${DOMAIN}`,
    });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create order ──────────────────────────────────────────────────────────────
interface CreateOrderBody {
  // Identification
  qrName: string;
  templateId: number | string;
  templateType?: string;         // 'galaxy' | 'christmas' | 'loveletter'
  // Content varies by template type
  content?: string;              // letter text (loveletter / christmas)
  imageUrls?: string[];          // uploaded image URLs (galaxy / christmas / loveletter)
  musicUrl?: string;             // music file URL
  // Legacy / extras
  musicLink?: string;
  musicAdded?: boolean;
  keychainPurchased?: boolean;
  tipAmount?: number;
  voucherCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

router.post('/', async (req: Request<object, object, CreateOrderBody>, res: Response) => {
  try {
    const {
      qrName,
      content = '',
      templateId,
      templateType,
      imageUrls = [],
      musicUrl,
      musicLink,
      musicAdded,
      keychainPurchased,
      tipAmount,
      voucherCode,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;

    if (!qrName || !templateId) {
      return res.status(400).json({ success: false, error: 'qrName and templateId are required' });
    }

    // Resolve template_type from explicit field or from templateId mapping
    const resolvedTemplateType: TemplateType =
      (templateType && VALID_TEMPLATE_TYPES.includes(templateType as TemplateType)
        ? templateType as TemplateType
        : TEMPLATE_TYPE_MAP[String(templateId)] || null) as TemplateType;

    if (!resolvedTemplateType) {
      return res.status(400).json({
        success: false,
        error: `Unknown template type. Supported: ${VALID_TEMPLATE_TYPES.join(', ')}`,
      });
    }

    // Build template_data JSON based on template type
    const templateData: Record<string, unknown> = { content };
    if (imageUrls.length > 0) templateData.imageUrls = imageUrls;
    if (musicUrl) templateData.musicUrl = musicUrl;
    if (musicLink) templateData.musicUrl = musicLink; // legacy field

    // Get template price
    const templateResult = await db.query('SELECT price FROM templates WHERE id = $1', [templateId]);
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    const templatePrice = templateResult.rows[0].price;

    const MUSIC_PRICE = 10000;
    const KEYCHAIN_PRICE = 0;
    const musicPrice = musicAdded ? MUSIC_PRICE : 0;
    const keychainPrice = keychainPurchased ? KEYCHAIN_PRICE : 0;

    // Voucher
    let voucherDiscount: number | null = 0;
    let discountType: string | null = null;
    if (voucherCode) {
      const voucherResult = await db.query(
        `SELECT * FROM vouchers
         WHERE code = $1 AND is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
        [voucherCode.toUpperCase()]
      );
      if (voucherResult.rows.length > 0) {
        const v = voucherResult.rows[0];
        voucherDiscount = parseFloat(v.discount_value);
        discountType = v.discount_type;
        await db.query('UPDATE vouchers SET used_count = used_count + 1 WHERE id = $1', [v.id]);
      }
    }

    const { subtotal, total, discount } = calculateTotal(
      templatePrice, keychainPrice, musicPrice, tipAmount || 0, voucherDiscount, discountType
    );

    const qrNameLower = qrName.toLowerCase();
    const fullUrl = `${qrNameLower}.${DOMAIN}`;

    await db.query('BEGIN');
    try {
      // Upsert QR code row (supports re-ordering the same name)
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
        [qrNameLower, fullUrl, content, templateId, resolvedTemplateType, JSON.stringify(templateData)]
      );

      const qrCodeId = qrResult.rows[0].id;

      const orderResult = await db.query(
        `INSERT INTO orders (
          qr_code_id, customer_name, customer_email, customer_phone,
          template_id, qr_name, content, music_link, music_added,
          keychain_purchased, keychain_price, tip_amount, voucher_code, voucher_discount,
          subtotal, total_amount, status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        RETURNING *`,
        [
          qrCodeId, customerName || null, customerEmail || null, customerPhone || null,
          templateId, qrNameLower, content, musicUrl || musicLink || null,
          musicAdded || false, keychainPurchased || false, keychainPrice,
          tipAmount || 0, voucherCode || null, discount, subtotal, total, 'pending',
        ]
      );

      await db.query('COMMIT');

      return res.json({
        success: true,
        order: orderResult.rows[0],
        qrCode: {
          id: qrCodeId,
          qrName: qrNameLower,
          fullUrl,
          templateType: resolvedTemplateType,
        },
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    const err = error as Error;
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get order by ID ───────────────────────────────────────────────────────────
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT o.*, t.name as template_name, t.image_url as template_image
       FROM orders o LEFT JOIN templates t ON o.template_id = t.id
       WHERE o.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    const err = error as Error;
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

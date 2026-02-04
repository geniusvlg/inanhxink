import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

interface OrderTotal {
  subtotal: number;
  total: number;
  discount: number;
}

// Calculate order total
function calculateTotal(
  templatePrice: number | string,
  keychainPrice: number | string | null,
  musicPrice: number | string | null,
  tipAmount: number | string,
  voucherDiscount: number | null,
  discountType: string | null
): OrderTotal {
  let subtotal = parseFloat(String(templatePrice)) || 0;
  
  if (keychainPrice) {
    subtotal += parseFloat(String(keychainPrice));
  }
  
  if (musicPrice) {
    subtotal += parseFloat(String(musicPrice));
  }
  
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

interface CheckQrNameBody {
  qrName: string;
}

// Check if QR name is available
router.post('/check-qr-name', async (req: Request<{}, {}, CheckQrNameBody>, res: Response) => {
  try {
    const { qrName } = req.body;
    
    if (!qrName) {
      return res.status(400).json({ 
        success: false, 
        error: 'QR name is required' 
      });
    }
    
    // Validate format: lowercase, no spaces, no special chars except dash and underscore
    const validPattern = /^[a-z0-9_-]+$/;
    if (!validPattern.test(qrName)) {
      return res.status(400).json({ 
        success: false, 
        error: 'QR name must be lowercase letters, numbers, dashes, or underscores only' 
      });
    }
    
    const result = await db.query(
      'SELECT id FROM qr_codes WHERE qr_name = $1',
      [qrName.toLowerCase()]
    );
    
    if (result.rows.length > 0) {
      return res.json({ 
        success: false, 
        available: false, 
        message: 'QR name already taken' 
      });
    }
    
    return res.json({ 
      success: true, 
      available: true, 
      message: 'QR name is available',
      fullUrl: `${qrName.toLowerCase()}.tokitoki.love`
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error checking QR name:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

interface CreateOrderBody {
  qrName: string;
  content: string;
  templateId: number | string;
  musicLink?: string;
  musicAdded?: boolean;
  keychainPurchased?: boolean;
  tipAmount?: number;
  voucherCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

// Create order
router.post('/', async (req: Request<{}, {}, CreateOrderBody>, res: Response) => {
  try {
    const {
      qrName,
      content,
      templateId,
      musicLink,
      musicAdded,
      keychainPurchased,
      tipAmount,
      voucherCode,
      customerName,
      customerEmail,
      customerPhone,
    } = req.body;
    
    // Validate required fields
    if (!qrName || !content || !templateId) {
      return res.status(400).json({ 
        success: false, 
        error: 'QR name, content, and template ID are required' 
      });
    }
    
    // Validate content: max 11 lines, 7 chars per line
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length > 11) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content must not exceed 11 lines' 
      });
    }
    
    for (const line of lines) {
      if (line.length > 7) {
        return res.status(400).json({ 
          success: false, 
          error: `Line "${line}" exceeds 7 characters` 
        });
      }
    }
    
    // Get template price
    const templateResult = await db.query(
      'SELECT price FROM templates WHERE id = $1',
      [templateId]
    );
    
    if (templateResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
    }
    
    const templatePrice = templateResult.rows[0].price;
    const MUSIC_PRICE = 10000; // 10,000đ for adding music
    const KEYCHAIN_PRICE = 0; // Set keychain price (can be configured)
    const musicPrice = musicAdded ? MUSIC_PRICE : 0;
    const keychainPrice = keychainPurchased ? KEYCHAIN_PRICE : 0;
    
    // Get voucher discount if provided
    let voucherDiscount: number | null = 0;
    let discountType: string | null = null;
    
    if (voucherCode) {
      const voucherResult = await db.query(
        `SELECT * FROM vouchers 
         WHERE code = $1 
         AND is_active = true 
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses IS NULL OR used_count < max_uses)`,
        [voucherCode.toUpperCase()]
      );
      
      if (voucherResult.rows.length > 0) {
        const voucher = voucherResult.rows[0];
        voucherDiscount = parseFloat(voucher.discount_value);
        discountType = voucher.discount_type;
        
        // Update voucher usage count
        await db.query(
          'UPDATE vouchers SET used_count = used_count + 1 WHERE id = $1',
          [voucher.id]
        );
      }
    }
    
    // Calculate totals
    const { subtotal, total, discount } = calculateTotal(
      templatePrice,
      keychainPrice,
      musicPrice,
      tipAmount || 0,
      voucherDiscount,
      discountType
    );
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // Create QR code
      const qrResult = await db.query(
        `INSERT INTO qr_codes (qr_name, full_url, content, template_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          qrName.toLowerCase(),
          `${qrName.toLowerCase()}.tokitoki.love`,
          content,
          templateId
        ]
      );
      
      const qrCodeId = qrResult.rows[0].id;
      
      // Create order
      const orderResult = await db.query(
        `INSERT INTO orders (
          qr_code_id, customer_name, customer_email, customer_phone,
          template_id, qr_name, content, music_link, music_added,
          keychain_purchased, keychain_price, tip_amount, voucher_code, voucher_discount,
          subtotal, total_amount, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          qrCodeId,
          customerName || null,
          customerEmail || null,
          customerPhone || null,
          templateId,
          qrName.toLowerCase(),
          content,
          musicLink || null,
          musicAdded || false,
          keychainPurchased || false,
          keychainPrice,
          tipAmount || 0,
          voucherCode || null,
          discount,
          subtotal,
          total,
          'pending'
        ]
      );
      
      await db.query('COMMIT');
      
      return res.json({
        success: true,
        order: orderResult.rows[0],
        qrCode: {
          id: qrCodeId,
          qrName: qrName.toLowerCase(),
          fullUrl: `${qrName.toLowerCase()}.tokitoki.love`,
        }
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    const err = error as Error;
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get order by ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT o.*, t.name as template_name, t.image_url as template_image
       FROM orders o
       LEFT JOIN templates t ON o.template_id = t.id
       WHERE o.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    
    return res.json({ success: true, order: result.rows[0] });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching order:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


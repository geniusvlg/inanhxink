import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

interface VoucherRequestBody {
  code: string;
}

// Validate voucher code
router.post('/validate', async (req: Request<{}, {}, VoucherRequestBody>, res: Response) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Voucher code is required' 
      });
    }
    
    const result = await db.query(
      `SELECT * FROM vouchers 
       WHERE code = $1 
       AND is_active = true 
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR used_count < max_uses)`,
      [code.toUpperCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Invalid or expired voucher code' 
      });
    }
    
    const voucher = result.rows[0];
    return res.json({ 
      success: true, 
      voucher: {
        code: voucher.code,
        discountType: voucher.discount_type,
        discountValue: parseFloat(voucher.discount_value),
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error validating voucher:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


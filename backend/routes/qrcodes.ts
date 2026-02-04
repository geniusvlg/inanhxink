import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

// Get QR code by name
router.get('/:qrName', async (req: Request<{ qrName: string }>, res: Response) => {
  try {
    const { qrName } = req.params;
    
    const result = await db.query(
      `SELECT qr.*, t.name as template_name, t.description as template_description, 
              t.image_url as template_image_url, t.price as template_price
       FROM qr_codes qr
       LEFT JOIN templates t ON qr.template_id = t.id
       WHERE qr.qr_name = $1`,
      [qrName.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'QR code not found' 
      });
    }
    
    const qrCode = result.rows[0];
    
    // Parse content lines
    const contentLines = qrCode.content.split('\n').filter((line: string) => line.trim());
    
    return res.json({
      success: true,
      qrCode: {
        id: qrCode.id,
        qrName: qrCode.qr_name,
        fullUrl: qrCode.full_url,
        content: qrCode.content,
        contentLines: contentLines,
        template: {
          id: qrCode.template_id,
          name: qrCode.template_name,
          description: qrCode.template_description,
          imageUrl: qrCode.template_image_url,
          price: qrCode.template_price,
        },
        createdAt: qrCode.created_at,
      }
    });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching QR code:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


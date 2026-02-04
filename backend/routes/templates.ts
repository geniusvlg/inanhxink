import express, { Router, Request, Response } from 'express';
import db from '../config/database';

const router: Router = express.Router();

// Get all active templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await db.query(
      'SELECT * FROM templates WHERE is_active = true ORDER BY id ASC'
    );
    return res.json({ success: true, templates: result.rows });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching templates:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get template by ID
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM templates WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    
    return res.json({ success: true, template: result.rows[0] });
  } catch (error) {
    const err = error as Error;
    console.error('Error fetching template:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


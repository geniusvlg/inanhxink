import { Router, Request, Response } from 'express';
import { sendError } from '../../middleware/sendError';
import { deleteFromS3 } from '../../config/s3';

const router = Router();

// DELETE /api/admin/uploads
// Body: { urls: string[] } — best-effort removal of S3 objects (used to
// clean up orphan files left behind when an admin cancels a pending upload
// or replaces an image without saving).
router.delete('/', async (req: Request, res: Response) => {
  const { urls } = req.body as { urls?: string[] };
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, error: 'urls (non-empty array) required' });
  }

  const results: { url: string; deleted: boolean; error?: string }[] = [];
  for (const url of urls) {
    try {
      const deleted = await deleteFromS3(url);
      results.push({ url, deleted });
    } catch (err) {
      results.push({ url, deleted: false, error: (err as Error).message });
    }
  }
  return res.json({ success: true, results });
});

export default router;

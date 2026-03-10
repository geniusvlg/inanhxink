import { Router, Request, Response } from 'express';

const router = Router();

const SUPPORTED_URL = /tiktok\.com|instagram\.com/i;

router.post('/extract', (req: Request, res: Response) => {
  const { url } = req.body as { url: string };

  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  if (!SUPPORTED_URL.test(url)) {
    return res.status(400).json({ success: false, error: 'Chỉ hỗ trợ link TikTok hoặc Instagram' });
  }

  return res.json({ success: true, url });
});

export default router;

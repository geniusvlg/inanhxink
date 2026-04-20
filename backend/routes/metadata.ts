import { Router, Request, Response } from 'express';
import db from '../config/database';
import { cdnUrl } from '../config/cdn';

const router = Router();

/**
 * Rewrite the imageUrl of every slide in the `product_banner_*` keys from
 * raw S3 origin to the CDN host. Mutates `config` in place.
 *
 * - `product_banner_slides` is a JSON array `[{ imageUrl, linkUrl? }, ...]`.
 * - `product_banner_overrides` is `{ [slug]: { mode, slides? } }` and any
 *   override with mode=custom can carry its own slide list to rewrite.
 *
 * Robust to malformed JSON (the original string is left untouched).
 */
function rewriteBannerSlides(config: Record<string, string>): void {
  const rewriteList = (raw: string): string => {
    try {
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return raw;
      const next = list.map(s => {
        if (!s || typeof s !== 'object') return s;
        const url = (s as { imageUrl?: unknown }).imageUrl;
        if (typeof url !== 'string') return s;
        return { ...s, imageUrl: cdnUrl(url) };
      });
      return JSON.stringify(next);
    } catch {
      return raw;
    }
  };

  if (config.product_banner_slides) {
    config.product_banner_slides = rewriteList(config.product_banner_slides);
  }

  if (config.product_banner_overrides) {
    try {
      const obj = JSON.parse(config.product_banner_overrides);
      if (obj && typeof obj === 'object') {
        for (const slug of Object.keys(obj)) {
          const entry = obj[slug];
          if (entry && Array.isArray(entry.slides)) {
            entry.slides = entry.slides.map((s: unknown) => {
              if (!s || typeof s !== 'object') return s;
              const url = (s as { imageUrl?: unknown }).imageUrl;
              if (typeof url !== 'string') return s;
              return { ...(s as object), imageUrl: cdnUrl(url) };
            });
          }
        }
        config.product_banner_overrides = JSON.stringify(obj);
      }
    } catch {
      // leave as-is
    }
  }
}

// GET /api/metadata — return all config as a key/value object
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT key, value FROM metadata');
    const config: Record<string, string> = {};
    for (const row of result.rows) {
      config[row.key] = row.value;
    }
    rewriteBannerSlides(config);
    return res.json({ success: true, config });
  } catch (err) {
    console.error('Error fetching metadata:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { sendError } from '../middleware/sendError';
import db from '../config/database';
import { cdnUrl } from '../config/cdn';

const router = Router();

// GET /api/testimonials — public list, ordered by featured/sort/created.
// image_url is rewritten from raw S3 to the public CDN so customers never
// hit the bucket directly (cheaper bandwidth + edge caching).
//
// Pagination contract:
//   • No query params  → returns ALL rows (backward-compat for the homepage
//     `FeaturedFeedback` widget, which filters client-side by
//     `is_featured_on_home`).
//   • `?page=N`        → returns paginated slice. `page_size` defaults to
//     the `testimonials_page_size` metadata value (fallback 12), capped to
//     a sane maximum to prevent abuse.
router.get('/', async (req: Request, res: Response) => {
  try {
    const pageRaw = req.query.page;
    const isPaginated = pageRaw !== undefined;

    if (!isPaginated) {
      const result = await db.query(
        `SELECT id, image_url, reviewer_name, caption,
                is_featured, is_featured_on_home
         FROM testimonials
         ORDER BY is_featured DESC, sort_order ASC, created_at DESC`,
      );
      const testimonials = result.rows.map(r => ({
        ...r,
        image_url: cdnUrl(r.image_url),
      }));
      return res.json({ success: true, testimonials });
    }

    const page = Math.max(1, parseInt(String(pageRaw), 10) || 1);

    let pageSize = parseInt(String(req.query.page_size ?? ''), 10);
    if (!pageSize || pageSize < 1) {
      const meta = await db.query(
        `SELECT value FROM metadata WHERE key = 'testimonials_page_size'`,
      );
      pageSize = parseInt(meta.rows[0]?.value, 10) || 12;
    }
    pageSize = Math.min(60, pageSize);

    const offset = (page - 1) * pageSize;

    const [countResult, pageResult] = await Promise.all([
      db.query(`SELECT COUNT(*)::text AS count FROM testimonials`),
      db.query(
        `SELECT id, image_url, reviewer_name, caption,
                is_featured, is_featured_on_home
         FROM testimonials
         ORDER BY is_featured DESC, sort_order ASC, created_at DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset],
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const testimonials = pageResult.rows.map(r => ({
      ...r,
      image_url: cdnUrl(r.image_url),
    }));

    return res.json({
      success: true,
      testimonials,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

export default router;

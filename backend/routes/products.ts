import { Router, Request, Response } from 'express';
import db from '../config/database';
import { rewriteRowImageFields } from '../config/cdn';

const router = Router();

// All public product endpoints rewrite the `images` JSONB array from raw
// S3 URLs to public CDN URLs. The DB always stores raw S3.
const withCdn = <T extends Record<string, unknown>>(row: T) =>
  rewriteRowImageFields(row, { array: ['images'] });

// GET /api/products?type=&category_ids=1,2&min_price=&max_price=&sort=newest|price_asc|price_desc&page=1&limit=12
router.get('/', async (req: Request, res: Response) => {
  try {
    const { type, category_ids, min_price, max_price, sort } = req.query as Record<string, string | undefined>;
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(48, parseInt(req.query.limit as string) || 12);
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    const conditions: string[] = ['p.is_active = true', 'p.is_draft = false'];

    if (type) {
      params.push(type);
      conditions.push(`p.type = $${params.length}`);
    }
    if (min_price && !isNaN(Number(min_price))) {
      params.push(Number(min_price));
      conditions.push(`p.price >= $${params.length}`);
    }
    if (max_price && !isNaN(Number(max_price))) {
      params.push(Number(max_price));
      conditions.push(`p.price <= $${params.length}`);
    }
    if (category_ids) {
      const ids = category_ids.split(',').map(Number).filter(Boolean);
      if (ids.length > 0) {
        params.push(ids);
        conditions.push(
          `p.id IN (SELECT product_id FROM product_category_map WHERE category_id = ANY($${params.length}::int[]))`
        );
      }
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'ORDER BY p.updated_at DESC, p.created_at DESC';
    if (sort === 'price_asc')  orderBy = 'ORDER BY p.price ASC,  p.updated_at DESC, p.created_at DESC';
    if (sort === 'price_desc') orderBy = 'ORDER BY p.price DESC, p.updated_at DESC, p.created_at DESC';

    // COUNT uses the same WHERE but no GROUP BY / ORDER BY
    const countResult = await db.query(
      `SELECT COUNT(DISTINCT p.id) AS total
       FROM products p
       LEFT JOIN product_category_map m ON m.product_id = p.id
       ${where}`,
      [...params]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Paginated main query
    params.push(limit, offset);
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_best_seller, p.tiktok_url, p.instagram_url,
         p.discount_price, p.discount_from, p.discount_to,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       ${where}
       GROUP BY p.id
       ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({ success: true, products: result.rows.map(withCdn), total, page, limit });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/products/featured-on-home
// Returns every active, non-draft product that admins have flagged for the
// public homepage, ordered by manual `home_sort_order` (then by id for ties).
//
// MUST be declared before the `:id` route below — otherwise Express would
// match "featured-on-home" as the `:id` param.
router.get('/featured-on-home', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type,
              p.is_best_seller, p.tiktok_url, p.instagram_url,
              p.discount_price, p.discount_from, p.discount_to,
              p.home_sort_order,
              COALESCE(
                json_agg(json_build_object('id', pc.id, 'name', pc.name))
                FILTER (WHERE pc.id IS NOT NULL), '[]'
              ) AS categories
         FROM products p
         LEFT JOIN product_category_map m  ON m.product_id  = p.id
         LEFT JOIN product_categories   pc ON pc.id = m.category_id
        WHERE p.is_active = TRUE
          AND p.is_draft = FALSE
          AND p.is_featured_on_home = TRUE
        GROUP BY p.id
        ORDER BY p.home_sort_order ASC, p.id ASC`
    );
    return res.json({ success: true, products: result.rows.map(withCdn) });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_active, p.is_best_seller, p.tiktok_url, p.instagram_url, p.created_at,
         p.discount_price, p.discount_from, p.discount_to,
         COALESCE(
           json_agg(json_build_object('id', pc.id, 'name', pc.name))
           FILTER (WHERE pc.id IS NOT NULL), '[]'
         ) AS categories
       FROM products p
       LEFT JOIN product_category_map m  ON m.product_id  = p.id
       LEFT JOIN product_categories   pc ON pc.id = m.category_id
       WHERE p.id = $1 AND p.is_active = true AND p.is_draft = false
       GROUP BY p.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    return res.json({ success: true, product: withCdn(result.rows[0]) });
  } catch (err) {
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
});

export default router;

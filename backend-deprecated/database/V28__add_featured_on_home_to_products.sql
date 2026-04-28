-- Adds two columns enabling admins to feature individual products on the
-- public homepage with a manual sort order.
--
--   is_featured_on_home  TRUE  → product appears in the homepage polaroid grid
--   home_sort_order      lower numbers appear first; ties broken by product id

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_featured_on_home BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS home_sort_order     INTEGER NOT NULL DEFAULT 0;

-- Partial index — only the (typically small) set of featured rows is indexed,
-- which keeps the public homepage query fast without bloating writes elsewhere.
CREATE INDEX IF NOT EXISTS idx_products_featured_on_home
  ON products (home_sort_order ASC, id ASC)
  WHERE is_featured_on_home = TRUE;

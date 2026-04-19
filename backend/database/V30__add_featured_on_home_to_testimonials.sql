-- Adds an explicit "show on homepage" flag to testimonials, separate from
-- the existing is_featured (which controls ordering on /danh-gia). Lets
-- admins curate a small subset of testimonials for the homepage hero
-- feedback section without affecting the masonry page.

ALTER TABLE testimonials
  ADD COLUMN IF NOT EXISTS is_featured_on_home BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial index for the hot path: homepage hits filter on this flag.
CREATE INDEX IF NOT EXISTS idx_testimonials_featured_on_home
  ON testimonials (sort_order ASC, created_at DESC)
  WHERE is_featured_on_home = TRUE;

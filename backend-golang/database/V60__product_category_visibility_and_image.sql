-- Admins can now choose which categories show on the public storefront and
-- upload a custom cover image per category, instead of it always being
-- auto-derived from the best-selling product's thumbnail.
ALTER TABLE product_categories
  ADD COLUMN image_url TEXT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

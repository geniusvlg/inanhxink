-- Categories are now shared across all product types (thiep, khung_anh, etc.)
-- The `type` column is no longer needed on product_categories.
ALTER TABLE product_categories DROP COLUMN IF EXISTS type;

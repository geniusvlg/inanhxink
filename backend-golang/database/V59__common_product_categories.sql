-- Categories become common across all product types instead of scoped to one.
-- Existing typed categories (e.g. "Sinh nhật" for thiep) keep their type;
-- new categories may omit it (type IS NULL = applies to every product type).
ALTER TABLE product_categories ALTER COLUMN type DROP NOT NULL;

-- The existing UNIQUE (name, type) constraint doesn't stop duplicate common
-- category names, since NULL is never equal to NULL. Guard that case
-- separately so two untyped "Sinh nhật" rows can't be created.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_name_untyped
  ON product_categories (name) WHERE type IS NULL;

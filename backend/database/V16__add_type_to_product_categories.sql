-- Re-add type column to product_categories (was removed in V8).
-- Needed so the same category name can exist independently per product type
-- (e.g. "Sinh nhật" for thiep AND for khung_anh are separate rows).
ALTER TABLE product_categories ADD COLUMN IF NOT EXISTS type VARCHAR(20) NOT NULL DEFAULT '';

-- Unique on (name, type) so ON CONFLICT works correctly in seed scripts
-- and duplicate (name, type) pairs are rejected.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_product_categories_name_type'
  ) THEN
    ALTER TABLE product_categories
      ADD CONSTRAINT uq_product_categories_name_type UNIQUE (name, type);
  END IF;
END $$;

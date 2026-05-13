-- Allow admin-seeded reviews without a real product_order; optional display fields for storefront.

ALTER TABLE product_reviews
  ADD COLUMN IF NOT EXISTS is_admin_entry BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS display_customer_name TEXT,
  ADD COLUMN IF NOT EXISTS display_invoice TEXT,
  ADD COLUMN IF NOT EXISTS display_ordered_product TEXT;

ALTER TABLE product_reviews ALTER COLUMN product_order_id DROP NOT NULL;

ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_entry_kind;

ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_entry_kind CHECK (
  (is_admin_entry = false AND product_order_id IS NOT NULL
    AND display_customer_name IS NULL AND display_invoice IS NULL AND display_ordered_product IS NULL)
  OR
  (is_admin_entry = true AND product_order_id IS NULL
    AND display_customer_name IS NOT NULL AND length(trim(display_customer_name)) > 0
    AND display_invoice IS NOT NULL AND length(trim(display_invoice)) > 0
    AND display_ordered_product IS NOT NULL AND length(trim(display_ordered_product)) > 0)
);

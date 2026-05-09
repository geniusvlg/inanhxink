ALTER TABLE products
  ADD COLUMN IF NOT EXISTS sold_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE products
  ADD CONSTRAINT products_sold_count_non_negative CHECK (sold_count >= 0);

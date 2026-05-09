CREATE TABLE IF NOT EXISTS product_variants (
  id         SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  price      DECIMAL(12,0) NOT NULL,
  image      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

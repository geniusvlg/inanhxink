-- Verified purchase reviews: one row per (product_order, product).
-- Customers submit invoice_number; backend resolves paid product_orders and checks items JSON.

CREATE TABLE IF NOT EXISTS product_reviews (
  id                 SERIAL PRIMARY KEY,
  product_order_id   INTEGER NOT NULL REFERENCES product_orders(id) ON DELETE CASCADE,
  product_id         INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating             SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment            TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_reviews_order_product UNIQUE (product_order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id_created
  ON product_reviews (product_id, created_at DESC);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0;

-- Keep review_count / average_rating in sync (admin cannot spoof via API — not in UpdateProduct allowlist).
CREATE OR REPLACE FUNCTION refresh_product_review_stats()
RETURNS TRIGGER AS $$
DECLARE
  pids INT[];
  x INT;
  cnt INT;
  avg_r NUMERIC(4,2);
BEGIN
  IF TG_OP = 'DELETE' THEN
    pids := ARRAY[OLD.product_id];
  ELSIF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    pids := ARRAY[OLD.product_id, NEW.product_id];
  ELSE
    pids := ARRAY[NEW.product_id];
  END IF;

  FOREACH x IN ARRAY pids LOOP
    SELECT COALESCE(COUNT(*)::INT, 0),
           CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND((AVG(rating))::NUMERIC, 2) END
    INTO cnt, avg_r
    FROM product_reviews
    WHERE product_id = x;

    UPDATE products
    SET review_count = cnt,
        average_rating = avg_r
    WHERE products.id = x;
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_reviews_stats ON product_reviews;
CREATE TRIGGER trg_product_reviews_stats
  AFTER INSERT OR UPDATE OR DELETE ON product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION refresh_product_review_stats();

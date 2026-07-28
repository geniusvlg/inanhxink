-- A product view bumps sold_count (see GetProduct in products.go), which
-- previously fired trg_products_updated_at and bumped updated_at too. Since
-- catalog list order defaults to ORDER BY updated_at DESC, that made viewing
-- a product silently reorder both the public and admin product lists.
--
-- Redefine the trigger to ignore sold_count-only changes: updated_at only
-- bumps when some other column actually changed.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
DECLARE
  comparable_new products;
BEGIN
  comparable_new := NEW;
  comparable_new.sold_count := OLD.sold_count;
  comparable_new.updated_at := OLD.updated_at;

  IF comparable_new IS DISTINCT FROM OLD THEN
    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

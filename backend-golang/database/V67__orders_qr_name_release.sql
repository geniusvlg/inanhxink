-- Admin can release a qr_name so another customer may reuse it. The order rows
-- stay for accounting; this column marks that they no longer own the name.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS qr_name_released_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.qr_name_released_at IS
  'Set when an admin releases the qr_name for reuse. The order is kept for accounting but no longer owns the name, so paid-order conflict checks skip it.';

-- Ownership checks (activation conflict, public lookup) only look at orders that
-- still hold their name.
CREATE INDEX IF NOT EXISTS idx_orders_qr_name_active
  ON orders (qr_name)
  WHERE qr_name_released_at IS NULL;

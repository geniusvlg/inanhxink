-- tracking_code for QR keychain orders fulfilled via the fulfillment board.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(100);

-- Rename status → keychain_delivery_status to track physical keychain fulfillment.
-- NULL = no keychain purchased, pending = keychain ordered (awaiting payment),
-- processing = payment confirmed (being made), shipped = sent to customer.
ALTER TABLE orders RENAME COLUMN status TO keychain_delivery_status;

-- Backfill: NULL for no keychain, pending for keychain orders (admin adjusts as needed).
UPDATE orders SET keychain_delivery_status = NULL;
UPDATE orders SET keychain_delivery_status = 'pending'
  WHERE keychain_purchased = true;

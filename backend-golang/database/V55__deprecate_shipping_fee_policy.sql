-- Shipping fee threshold policy removed. Column and metadata rows kept for
-- historical data; new orders always write shipping_fee = 0.

COMMENT ON COLUMN product_orders.shipping_fee IS '[DEPRECATED] Always 0 — threshold-based shipping policy removed.';

UPDATE metadata SET description = '[DEPRECATED] Threshold-based shipping policy removed. No longer read by application.'
WHERE key IN ('product_shipping_fee_threshold', 'product_shipping_fee_below_threshold');

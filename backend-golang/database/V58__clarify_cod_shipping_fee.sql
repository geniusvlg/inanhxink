COMMENT ON COLUMN product_orders.shipping_fee IS 'Fixed product-order shipping fee. Bank-transfer orders store 0 only when subtotal reaches product_shipping_fee_threshold; COD orders include shipping.';

UPDATE metadata
SET description = 'Phí ship cố định (đ) áp dụng cho đơn Ship COD và đơn chuyển khoản dưới ngưỡng miễn phí ship; 0 = miễn phí ship'
WHERE key = 'product_shipping_fee';

INSERT INTO metadata (key, value, description) VALUES
  ('product_shipping_fee_threshold', '149000', 'Ngưỡng tạm tính để đơn chuyển khoản được miễn phí ship; mặc định 149000; 0 = chuyển khoản luôn miễn phí ship')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

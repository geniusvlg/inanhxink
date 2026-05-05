ALTER TABLE product_orders
ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE product_orders
SET shipping_fee = 0
WHERE shipping_fee IS NULL OR shipping_fee < 0;

INSERT INTO metadata (key, value, description) VALUES
  ('product_shipping_fee_threshold', '0', 'Miễn phí ship nếu tạm tính đạt ngưỡng này; 0 nghĩa là chưa áp dụng'),
  ('product_shipping_fee_below_threshold', '0', 'Phí ship áp dụng khi tạm tính thấp hơn ngưỡng; mặc định 0')
ON CONFLICT (key) DO NOTHING;

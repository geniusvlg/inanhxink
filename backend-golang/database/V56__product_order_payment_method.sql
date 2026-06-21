ALTER TABLE product_orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'bank_transfer',
  ADD COLUMN IF NOT EXISTS cod_fee DECIMAL(12,2) NOT NULL DEFAULT 0;

INSERT INTO metadata (key, value, description) VALUES
  ('product_cod_fee_percent', '30', 'Tỉ lệ đặt cọc khi chọn Ship COD (% giá trị đơn hàng); 100 để tắt')
ON CONFLICT (key) DO NOTHING;

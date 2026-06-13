INSERT INTO metadata (key, value, description) VALUES
  ('page_tao_ma_qr', 'true', 'Hiển thị trang Tạo mã QR cho khách đã mua QR')
ON CONFLICT (key) DO NOTHING;

UPDATE metadata
SET value = REPLACE(
  value,
  '"page_order_tracking"',
  '"page_order_tracking","page_tao_ma_qr"'
)
WHERE key = 'page_order'
  AND value NOT LIKE '%page_tao_ma_qr%';

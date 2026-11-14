-- One switch for both product purchase buttons on the storefront
-- (true = "Mua ngay" and "Thêm vào giỏ hàng" are shown, false = both are hidden).
INSERT INTO metadata (key, value, description) VALUES
  ('product_purchase_enabled', 'true', 'Hiện nút Mua ngay và Thêm vào giỏ hàng trên trang sản phẩm')
ON CONFLICT (key) DO NOTHING;

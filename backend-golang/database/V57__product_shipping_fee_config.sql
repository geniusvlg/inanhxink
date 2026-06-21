INSERT INTO metadata (key, value, description) VALUES
  ('product_shipping_fee', '30000', 'Phí ship cố định (đ) áp dụng cho tất cả đơn sản phẩm; 0 = miễn phí ship')
ON CONFLICT (key) DO NOTHING;

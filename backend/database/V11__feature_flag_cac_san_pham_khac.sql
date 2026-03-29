INSERT INTO metadata (key, value, description) VALUES
  ('page_cac_san_pham_khac', 'true', 'Hiển thị trang Các Sản Phẩm Khác')
ON CONFLICT (key) DO NOTHING;

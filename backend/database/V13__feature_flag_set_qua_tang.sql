INSERT INTO metadata (key, value, description) VALUES
  ('page_set_qua_tang', 'true', 'Hiển thị trang Set Quà Tặng')
ON CONFLICT (key) DO NOTHING;

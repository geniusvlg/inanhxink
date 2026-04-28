-- Feature flags for page visibility (true = shown to customers)
INSERT INTO metadata (key, value, description) VALUES
  ('page_qr_yeu_thuong', 'true', 'Hiển thị trang QR Yêu Thương'),
  ('page_thiep',         'true', 'Hiển thị trang Thiệp'),
  ('page_khung_anh',     'true', 'Hiển thị trang Khung Ảnh'),
  ('page_so_scrapbook',  'true', 'Hiển thị trang Sổ & Scrapbook')
ON CONFLICT (key) DO NOTHING;

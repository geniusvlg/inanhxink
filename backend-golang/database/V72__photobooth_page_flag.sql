INSERT INTO metadata (key, value, description) VALUES
  ('page_photobooth', 'true', 'Hiển thị trang Photobooth chụp ảnh lấy liền')
ON CONFLICT (key) DO NOTHING;

UPDATE metadata
SET value = REPLACE(
  value,
  '"page_danh_gia"',
  '"page_danh_gia","page_photobooth"'
)
WHERE key = 'page_order'
  AND value NOT LIKE '%page_photobooth%';

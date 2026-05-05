INSERT INTO metadata (key, value, description) VALUES
  ('page_danh_gia', 'true', 'Hiển thị trang Feedback / Đánh giá')
ON CONFLICT (key) DO NOTHING;

UPDATE metadata
SET value = '["page_qr_yeu_thuong","page_thiep","page_khung_anh","page_so_scrapbook","page_cac_san_pham_khac","page_set_qua_tang","page_in_anh","page_order_tracking","page_danh_gia"]'
WHERE key = 'page_order'
  AND value NOT LIKE '%page_danh_gia%';

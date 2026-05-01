INSERT INTO metadata (key, value, description) VALUES
  ('page_order_tracking', 'true', 'Hiển thị trang Tra cứu đơn hàng'),
  ('page_order', '["page_qr_yeu_thuong","page_thiep","page_khung_anh","page_so_scrapbook","page_cac_san_pham_khac","page_set_qua_tang","page_in_anh","page_order_tracking"]', 'Thứ tự hiển thị các trang trên menu')
ON CONFLICT (key) DO NOTHING;

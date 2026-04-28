-- Configurable page size for the public testimonials/feedback page
-- (`/danh-gia`). Stored alongside `products_page_size` so admins can tune
-- it independently from the product list pagination.
INSERT INTO metadata (key, value, description) VALUES
  ('testimonials_page_size', '12', 'Số đánh giá hiển thị trên mỗi trang của trang Feedback (/danh-gia)')
ON CONFLICT (key) DO NOTHING;

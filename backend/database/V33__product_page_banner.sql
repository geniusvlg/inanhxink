-- Admin-configurable image carousel banner shown at the top of each product
-- listing page hero (/thiep, /khung-anh, /so-scrapbook, /set-qua-tang,
-- /cac-san-pham-khac, /in-anh).
--
-- Smaller than the homepage banner (max 960 px wide, aspect 16:4). Supports
-- a global slide list with per-page overrides:
--   inherit  → show global slides
--   custom   → show this page's own slides (empty array → hide on this page)
--   disabled → hide on this page even if global is on
--
-- Slides are stored as a JSON array of { imageUrl: string, linkUrl?: string }.
-- We keep the raw S3 URLs here (per the project storage rule); the public
-- /api/metadata route rewrites them to CDN URLs at response time.
INSERT INTO metadata (key, value, description) VALUES
  ('product_banner_enabled', 'false', 'Bật/tắt banner trên các trang sản phẩm'),
  ('product_banner_slides',  '[]',    'Danh sách slide chung (JSON array of { imageUrl, linkUrl? })'),
  ('product_banner_overrides',
   '{"thiep":{"mode":"inherit"},"khung_anh":{"mode":"inherit"},"so_scrapbook":{"mode":"inherit"},"set_qua_tang":{"mode":"inherit"},"cac_san_pham_khac":{"mode":"inherit"},"in_anh":{"mode":"inherit"}}',
   'Ghi đè banner theo từng trang sản phẩm (JSON, mode = inherit | custom | disabled, có thể chứa slides riêng)')
ON CONFLICT (key) DO NOTHING;

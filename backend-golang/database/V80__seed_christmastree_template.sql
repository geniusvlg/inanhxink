-- Add the Christmas tree with gift boxes and postcards QR template.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Cây thông quà tặng',
  'Chạm ngôi sao để mở cây thông, rồi chạm hộp quà hoặc thiệp để xem ảnh và thư',
  '/templates/christmastree/thumbnail.svg',
  99000,
  true,
  'christmastree'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'christmastree'
);

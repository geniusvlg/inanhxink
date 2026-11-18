-- Add the Christmas tree QR template.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Cây thông Giáng sinh',
  'Chạm vào cây thông để ngôi sao bắn ảnh và lời chúc',
  '/templates/lovechristmas/thumbnail.svg',
  99000,
  true,
  'lovechristmas'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'lovechristmas'
);

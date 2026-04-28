-- Add the Special Gift template row.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Special Gift',
  'Trang quà tặng đặc biệt với lời nhắn và hình ảnh cá nhân hóa',
  '/templates/specialgift/thumbnail.png',
  99000,
  true,
  'specialgift'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'specialgift'
);

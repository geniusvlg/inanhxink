-- Add the Snow Heart template row.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Snow Heart',
  'Đêm tuyết rơi, chạm để tuyết kết thành trái tim với những vòng chữ yêu thương',
  '/templates/snowheart/thumbnail.svg',
  99000,
  true,
  'snowheart'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'snowheart'
);

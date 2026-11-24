-- Add the xmasgiftcard QR template (static Christmas card page).
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Thiệp Giáng sinh',
  'Chạm vào hình thiệp để mở lời chúc Giáng sinh',
  '/templates/xmasgiftcard/thumbnail.svg',
  99000,
  true,
  'xmasgiftcard'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'xmasgiftcard'
);

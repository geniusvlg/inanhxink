-- Add the tulip bouquet QR template.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Bó Hoa Tulip',
  'Chạm vào bó tulip để mở lời nhắn, đóng thiệp là những tấm ảnh bay lên',
  '/templates/giftflower/thumbnail.svg',
  99000,
  true,
  'giftflower'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'giftflower'
);

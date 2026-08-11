-- Add the farewell / study-abroad template.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Bon Voyage',
  'Tấm vé máy bay mở ra chuyến bay quanh quả cầu kỷ niệm, rồi hạ cánh ở đồng hồ hai múi giờ và lá thư chia tay trong phong bì',
  '/templates/farewell/thumbnail.svg',
  99000,
  true,
  'farewell'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'farewell'
);

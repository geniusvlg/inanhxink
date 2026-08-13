-- Add the Love Burst template row.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Love Burst',
  'Chạm để bắt đầu, lời nhắn hiện bằng hàng vạn hạt sáng, rồi quả cầu ảnh và phong thư',
  '/templates/loveburst/thumbnail.svg',
  99000,
  true,
  'loveburst'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'loveburst'
);

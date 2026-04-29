-- Add the Love Days template row.
-- ON CONFLICT DO NOTHING makes this safe to re-run.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
VALUES (
  'Love Days',
  'Đếm ngày yêu nhau – trang kỷ niệm lãng mạn dành cho hai người',
  '/templates/lovedays/lovedays.png',
  99000,
  true,
  'lovedays'
)
ON CONFLICT DO NOTHING;

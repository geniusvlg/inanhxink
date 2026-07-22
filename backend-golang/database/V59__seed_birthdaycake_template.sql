-- Add the Birthday Cake template row.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Birthday Cake',
  'Trang sinh nhật tương tác với hộp quà, thư chúc mừng, bánh và ảnh kỷ niệm',
  '/templates/birthdaycake/assets/images/birthday.png',
  99000,
  true,
  'birthdaycake'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'birthdaycake'
);

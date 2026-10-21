-- Add the Wax Seal template row.
-- Use NOT EXISTS because templates.template_type is not unique in older DBs.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
SELECT
  'Wax Seal',
  'Phong bì đỏ niêm sáp, mở từng lớp đến thư, bó hoa và những tấm ảnh kỷ niệm',
  '/templates/waxseal/thumbnail.svg',
  99000,
  true,
  'waxseal'
WHERE NOT EXISTS (
  SELECT 1 FROM templates WHERE template_type = 'waxseal'
);

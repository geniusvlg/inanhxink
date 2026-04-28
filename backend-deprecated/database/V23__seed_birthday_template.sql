-- V23: seed Birthday template + add product discount columns.

-- Add discount pricing support to products.
-- discount_price: the sale price (NULL = no discount)
-- discount_from:  when the discount starts (NULL = no lower bound)
-- discount_to:    when the discount ends   (NULL = no upper bound)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS discount_price DECIMAL(12,0) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_from  TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS discount_to    TIMESTAMPTZ   DEFAULT NULL;

-- Add the Birthday template row.
-- ON CONFLICT DO NOTHING makes this safe to re-run.
INSERT INTO templates (name, description, image_url, price, is_active, template_type)
VALUES (
  'Birthday',
  'Trang chúc mừng sinh nhật đặc biệt với hiệu ứng trái tim lung linh',
  '/templates/birthday/birthday.png',
  99000,
  true,
  'birthday'
)
ON CONFLICT DO NOTHING;

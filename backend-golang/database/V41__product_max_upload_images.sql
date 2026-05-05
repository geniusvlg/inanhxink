ALTER TABLE products
ADD COLUMN IF NOT EXISTS max_upload_images INTEGER NOT NULL DEFAULT 15;

UPDATE products
SET max_upload_images = 15
WHERE max_upload_images IS NULL OR max_upload_images < 1;


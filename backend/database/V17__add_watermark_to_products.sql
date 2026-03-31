-- Add watermark_enabled flag per product (default false = no watermark)
ALTER TABLE products ADD COLUMN IF NOT EXISTS watermark_enabled BOOLEAN NOT NULL DEFAULT false;

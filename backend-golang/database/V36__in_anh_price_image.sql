-- Seed the metadata key that stores the price-table image for /in-anh.
-- Value is a raw S3 URL (empty string = no image configured yet).
INSERT INTO metadata (key, value)
VALUES ('in_anh_price_image_url', '')
ON CONFLICT (key) DO NOTHING;

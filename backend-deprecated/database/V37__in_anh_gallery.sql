-- Gallery of reference photos shown below the price table on /in-anh.
-- Value is a JSON array of S3 URL strings.
INSERT INTO metadata (key, value)
VALUES ('in_anh_gallery', '[]')
ON CONFLICT (key) DO NOTHING;

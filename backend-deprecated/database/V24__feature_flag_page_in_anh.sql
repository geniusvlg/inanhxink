-- Add feature flag for the new "In Ảnh" page in frontend navigation.
INSERT INTO metadata (key, value)
VALUES ('page_in_anh', 'true')
ON CONFLICT (key) DO NOTHING;

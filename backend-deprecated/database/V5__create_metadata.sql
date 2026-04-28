CREATE TABLE IF NOT EXISTS metadata (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT
);

INSERT INTO metadata (key, value, description) VALUES
  ('music_price',    '10000', 'Giá thêm nhạc nền (VND)'),
  ('keychain_price', '35000', 'Giá móc khóa quét QR (VND)')
ON CONFLICT (key) DO NOTHING;

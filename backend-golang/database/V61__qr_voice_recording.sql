ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS voice_recording_added BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_recording_url VARCHAR(1000),
  ADD COLUMN IF NOT EXISTS voice_recording_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

INSERT INTO metadata (key, value, description) VALUES
  ('voice_recording_price', '10000', 'Giá thêm lời nhắn ghi âm cho QR (VND)')
ON CONFLICT (key) DO NOTHING;

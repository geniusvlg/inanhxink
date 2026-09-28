-- Default background-music volume, as a percent, when a QR also has a voice recording.
-- 4 means 4%. Music-only orders stay at 100%. Existing saved volumes are unchanged.
INSERT INTO metadata (key, value, description) VALUES
  ('default_music_volume', '4', 'Âm lượng nhạc nền mặc định (%) khi QR có cả nhạc và ghi âm')
ON CONFLICT (key) DO NOTHING;

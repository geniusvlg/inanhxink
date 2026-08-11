-- Toggle for the "Mua móc khóa quét QR" add-on on the QR order form
-- (true = customers can buy it, false = the option is hidden and never charged).
INSERT INTO metadata (key, value, description) VALUES
  ('keychain_enabled', 'true', 'Cho phép khách mua kèm móc khóa quét QR')
ON CONFLICT (key) DO NOTHING;

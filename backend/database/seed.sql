-- Insert sample templates
INSERT INTO templates (name, description, image_url, price) VALUES
('Echo of Heart', 'Dark background with sparkling pink particles forming a heart shape', '/templates/echo-of-heart.jpg', 40000),
('Heart Mosaic', 'Abstract mosaic-like heart shape with pink sparkling particles', '/templates/heart-mosaic.jpg', 40000),
('Stellar Bloom', 'Vibrant celebration scene with bright lights and confetti', '/templates/stellar-bloom.jpg', 40000),
('Love Letter', 'Light pink envelope with red heart seal', '/templates/love-letter.jpg', 40000),
('Minimalist Room', 'Clean room interior with wooden desk and plants', '/templates/minimalist-room.jpg', 40000),
('Dark Quote', 'Dark background with stylized white text', '/templates/dark-quote.jpg', 40000),
('Pink Particles', 'Dark background with horizontal lines of pink particles', '/templates/pink-particles.jpg', 40000),
('Speech Bubbles', 'Light pink background with white speech bubbles and hearts', '/templates/speech-bubbles.jpg', 40000),
('Romantic Sunset', 'Beautiful sunset scene with romantic atmosphere', '/templates/romantic-sunset.jpg', 40000),
('Starry Night', 'Night sky with stars and moon', '/templates/starry-night.jpg', 40000)
ON CONFLICT DO NOTHING;

-- Insert sample vouchers
INSERT INTO vouchers (code, discount_type, discount_value, max_uses, expires_at) VALUES
('WELCOME10', 'percentage', 10, 100, '2025-12-31 23:59:59'),
('LOVE20', 'percentage', 20, 50, '2025-12-31 23:59:59'),
('SAVE5000', 'fixed', 5000, 200, '2025-12-31 23:59:59')
ON CONFLICT DO NOTHING;


-- Seed default templates that match the template folders baked into the Docker image.
-- ON CONFLICT DO NOTHING ensures this is safe to re-run on existing databases.

INSERT INTO templates (name, description, image_url, price, is_active, template_type)
VALUES
  (
    'Love Letter',
    'Thiệp tình yêu lãng mạn',
    '/templates/loveletter/loveletter.jpg',
    99000,
    true,
    'loveletter'
  ),
  (
    'Letter In Space',
    'Thư tình trong không gian vũ trụ huyền ảo',
    '/templates/letterinspace/thumbnail.jpg',
    99000,
    true,
    'letterinspace'
  ),
  (
    'Galaxy',
    'Hành trình khám phá dải ngân hà',
    '/templates/galaxy/thumbnail.jpg',
    99000,
    true,
    'galaxy'
  )
ON CONFLICT DO NOTHING;

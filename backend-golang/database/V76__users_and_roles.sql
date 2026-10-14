-- Staff accounts live in users (renamed from admin_users). Roles are shared;
-- each permission is one row in role_permission. Keep the seeded keys in sync
-- with backend-golang/internal/authz/permissions.go.

CREATE TABLE "role" (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE role_permission (
  role_id    INT NOT NULL REFERENCES "role"(id) ON DELETE CASCADE,
  permission VARCHAR(80) NOT NULL,
  PRIMARY KEY (role_id, permission)
);

ALTER TABLE admin_users RENAME TO users;

ALTER TABLE users
  ADD COLUMN display_name VARCHAR(100),
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN role_id INT REFERENCES "role"(id);

INSERT INTO "role" (name, description, is_system)
VALUES ('Admin', 'Toàn quyền', TRUE);

INSERT INTO role_permission (role_id, permission)
SELECT r.id, p.permission
FROM "role" r
CROSS JOIN (VALUES
  ('qr_templates.view'), ('qr_templates.create'), ('qr_templates.update'), ('qr_templates.delete'),
  ('thiep.view'), ('thiep.create'), ('thiep.update'), ('thiep.delete'),
  ('khung_anh.view'), ('khung_anh.create'), ('khung_anh.update'), ('khung_anh.delete'),
  ('so_scrapbook.view'), ('so_scrapbook.create'), ('so_scrapbook.update'), ('so_scrapbook.delete'),
  ('khac.view'), ('khac.create'), ('khac.update'), ('khac.delete'),
  ('set_qua_tang.view'), ('set_qua_tang.create'), ('set_qua_tang.update'), ('set_qua_tang.delete'),
  ('in_anh.view'), ('in_anh.create'), ('in_anh.update'), ('in_anh.delete'),
  ('featured.view'), ('featured.update'),
  ('categories.view'), ('categories.create'), ('categories.update'), ('categories.delete'),
  ('product_reviews.view'), ('product_reviews.create'), ('product_reviews.delete'),
  ('product_orders.view'), ('product_orders.update'),
  ('fulfillment.view'), ('fulfillment.update'),
  ('qr_orders.view'), ('qr_orders.update'),
  ('vouchers.view'), ('vouchers.create'), ('vouchers.update'), ('vouchers.delete'),
  ('testimonials.view'), ('testimonials.create'), ('testimonials.update'), ('testimonials.delete'),
  ('banners.view'), ('banners.create'), ('banners.update'), ('banners.delete'),
  ('hero_shots.view'), ('hero_shots.update'),
  ('config.view'), ('config.update')
) AS p(permission)
WHERE r.is_system;

UPDATE users SET role_id = (SELECT id FROM "role" WHERE is_system LIMIT 1);

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;

CREATE INDEX users_role_id_idx ON users (role_id);

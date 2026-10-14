# Admin roles

Staff who sign in to the admin app are rows in `users` (renamed from `admin_users`). Each person has one role. A role's permissions are rows in `role_permission`, one catalog key per row, such as `thiep.view` or `orders.update`.

## Tables

- `users` — `username`, `password_hash`, `display_name`, `is_active`, `role_id`
- `"role"` — `name`, `description`, `is_system`. The name is quoted in SQL because `ROLE` is reserved in PostgreSQL.
- `role_permission` — `role_id`, `permission`

Migration: `backend-golang/database/V76__users_and_roles.sql`.

The seeded **Admin** role has `is_system = true`. It cannot be renamed, edited, or deleted, and it always has every key in `backend-golang/internal/authz/permissions.go`. At least one active user must keep that role. Existing logins are assigned to it.

Other roles (Manager, Employee, and any name an admin creates) are created in the admin UI. Their permission checkboxes are the catalog. quản lý nhân viên and Role are not checkboxes: only the system Admin role can open those pages or call their APIs.

## Requests

`RequireAdmin` still checks the JWT (`id`, `username`) and then loads the role and permission rows, so a permission change applies on the next request.

- Missing or inactive account: 401
- Signed in but missing the permission: 403 (the admin app does not treat 403 as a logout)
- `GET /api/admin/auth/me` returns the signed-in user, role, and permission keys. The sidebar shows a page only when the matching `*.view` key is present.
- `/ho-so` is available to every signed-in user. It shows username, role, and that role's permissions. `PUT /api/admin/auth/profile` changes the signed-in user's display name. `POST /api/admin/auth/password` changes their password after checking the current one. Neither call changes the role.
- `GET /api/admin/roles/catalog` and every `/api/admin/roles` and `/api/admin/users` route require the system Admin role.

Product type pages share `/api/admin/products` and are checked from `products.type` (`thiep`, `khung_anh`, `so_scrapbook`, `khac`, `set-qua-tang` → `set_qua_tang`, `in_anh`). A list with no type returns only types the user can view. The reviews page may list products when the user has `product_reviews.view`.

`GET/PUT /api/admin/metadata` is shared. `config.view` / `config.update` see the whole map. `in_anh.*` is limited to `in_anh_*` keys, and `banners.*` is limited to `product_banner_*` keys.

`DELETE /api/admin/uploads` is allowed for any active user who has at least one `create` or `update` permission. It only removes files during an edit.

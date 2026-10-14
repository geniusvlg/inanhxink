package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/authz"
	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/roles/catalog
func RoleCatalog(w http.ResponseWriter, r *http.Request) {
	handlers.OK(w, map[string]any{"success": true, "areas": authz.Catalog})
}

// GET /api/admin/roles
func ListRoles(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, name, COALESCE(description, '') AS description, is_system
		FROM "role"
		ORDER BY is_system DESC, name ASC`)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	roles, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if roles == nil {
		roles = []map[string]any{}
	}
	permRows, err := config.DB.Query(context.Background(),
		`SELECT role_id, permission FROM role_permission ORDER BY permission`)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer permRows.Close()
	byRole := map[int][]string{}
	for permRows.Next() {
		var roleID int
		var key string
		if err := permRows.Scan(&roleID, &key); err != nil {
			handlers.InternalError(w, err)
			return
		}
		if authz.Known(key) {
			byRole[roleID] = append(byRole[roleID], key)
		}
	}
	if err := permRows.Err(); err != nil {
		handlers.InternalError(w, err)
		return
	}
	for _, role := range roles {
		id := intFromRow(role["id"])
		perms := byRole[id]
		if perms == nil {
			perms = []string{}
		}
		if system, _ := role["is_system"].(bool); system {
			perms = authz.AllKeys()
		}
		role["permissions"] = perms
	}
	handlers.OK(w, map[string]any{"success": true, "roles": roles})
}

// POST /api/admin/roles
func CreateRole(w http.ResponseWriter, r *http.Request) {
	body, ok := decodeRoleBody(w, r)
	if !ok {
		return
	}
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint
	var id int
	err = tx.QueryRow(context.Background(), `
		INSERT INTO "role" (name, description, is_system)
		VALUES ($1, $2, FALSE) RETURNING id`, body.Name, body.Description).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			handlers.Conflict(w, "Tên vai trò đã tồn tại")
			return
		}
		handlers.InternalError(w, err)
		return
	}
	if err := insertRolePermissions(tx, id, body.Permissions); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true, "id": id})
}

// PUT /api/admin/roles/{id}
func UpdateRole(w http.ResponseWriter, r *http.Request) {
	id, ok := roleID(w, r)
	if !ok {
		return
	}
	body, ok := decodeRoleBody(w, r)
	if !ok {
		return
	}
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint
	var system bool
	err = tx.QueryRow(context.Background(), `SELECT is_system FROM "role" WHERE id = $1 FOR UPDATE`, id).Scan(&system)
	if err == pgx.ErrNoRows {
		handlers.NotFound(w)
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if system {
		handlers.BadRequest(w, "Không thể sửa vai trò Admin")
		return
	}
	tag, err := tx.Exec(context.Background(),
		`UPDATE "role" SET name = $1, description = $2 WHERE id = $3`, body.Name, body.Description, id)
	if err != nil {
		if isUniqueViolation(err) {
			handlers.Conflict(w, "Tên vai trò đã tồn tại")
			return
		}
		handlers.InternalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	if _, err := tx.Exec(context.Background(), `DELETE FROM role_permission WHERE role_id = $1`, id); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if err := insertRolePermissions(tx, id, body.Permissions); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// DELETE /api/admin/roles/{id}
func DeleteRole(w http.ResponseWriter, r *http.Request) {
	id, ok := roleID(w, r)
	if !ok {
		return
	}
	var system bool
	err := config.DB.QueryRow(context.Background(), `SELECT is_system FROM "role" WHERE id = $1`, id).Scan(&system)
	if err == pgx.ErrNoRows {
		handlers.NotFound(w)
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if system {
		handlers.BadRequest(w, "Không thể xoá vai trò Admin")
		return
	}
	var users int
	if err := config.DB.QueryRow(context.Background(), `SELECT COUNT(*) FROM users WHERE role_id = $1`, id).Scan(&users); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if users > 0 {
		handlers.Conflict(w, "Vai trò đang được gán cho nhân viên")
		return
	}
	if _, err := config.DB.Exec(context.Background(), `DELETE FROM "role" WHERE id = $1`, id); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

type roleBody struct {
	Name        string
	Description string
	Permissions []string
}

func decodeRoleBody(w http.ResponseWriter, r *http.Request) (roleBody, bool) {
	var raw struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Permissions []string `json:"permissions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return roleBody{}, false
	}
	raw.Name = strings.TrimSpace(raw.Name)
	raw.Description = strings.TrimSpace(raw.Description)
	if raw.Name == "" || len(raw.Name) > 100 {
		handlers.BadRequest(w, "Tên vai trò không hợp lệ")
		return roleBody{}, false
	}
	if len(raw.Description) > 500 {
		handlers.BadRequest(w, "Mô tả quá dài")
		return roleBody{}, false
	}
	seen := map[string]struct{}{}
	perms := make([]string, 0, len(raw.Permissions))
	for _, key := range raw.Permissions {
		if !authz.Known(key) {
			handlers.BadRequest(w, "Quyền không hợp lệ")
			return roleBody{}, false
		}
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		perms = append(perms, key)
	}
	return roleBody{Name: raw.Name, Description: raw.Description, Permissions: perms}, true
}

func insertRolePermissions(tx pgx.Tx, roleID int, permissions []string) error {
	for _, key := range permissions {
		if _, err := tx.Exec(context.Background(),
			`INSERT INTO role_permission (role_id, permission) VALUES ($1, $2)`, roleID, key); err != nil {
			return err
		}
	}
	return nil
}

func roleID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || id < 1 {
		handlers.BadRequest(w, "invalid id")
		return 0, false
	}
	return id, true
}

func intFromRow(value any) int {
	switch n := value.(type) {
	case int:
		return n
	case int32:
		return int(n)
	case int64:
		return int(n)
	default:
		return 0
	}
}

package admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"golang.org/x/crypto/bcrypt"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

var usernamePattern = regexp.MustCompile(`^[A-Za-z0-9._-]{3,100}$`)

// GET /api/admin/users
func ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT u.id, u.username, COALESCE(u.display_name, '') AS display_name, u.is_active,
		       r.id AS role_id, r.name AS role_name, r.is_system
		FROM users u
		JOIN "role" r ON r.id = u.role_id
		ORDER BY u.id ASC`)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	list, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if list == nil {
		list = []map[string]any{}
	}
	users := make([]map[string]any, 0, len(list))
	for _, row := range list {
		users = append(users, map[string]any{
			"id":           row["id"],
			"username":     row["username"],
			"display_name": row["display_name"],
			"is_active":    row["is_active"],
			"role": map[string]any{
				"id":        row["role_id"],
				"name":      row["role_name"],
				"is_system": row["is_system"],
			},
		})
	}
	handlers.OK(w, map[string]any{"success": true, "users": users})
}

// POST /api/admin/users
func CreateUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username    string `json:"username"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
		RoleID      int    `json:"role_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	body.Username = strings.TrimSpace(body.Username)
	body.DisplayName = strings.TrimSpace(body.DisplayName)
	if !usernamePattern.MatchString(body.Username) {
		handlers.BadRequest(w, "Tên đăng nhập không hợp lệ")
		return
	}
	if len(body.Password) < 6 || len(body.Password) > 100 {
		handlers.BadRequest(w, "Mật khẩu phải từ 6 đến 100 ký tự")
		return
	}
	if len(body.DisplayName) > 100 {
		handlers.BadRequest(w, "Tên hiển thị quá dài")
		return
	}
	if !roleExists(w, body.RoleID) {
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	var id int
	err = config.DB.QueryRow(context.Background(), `
		INSERT INTO users (username, password_hash, display_name, role_id, is_active)
		VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
		body.Username, string(hash), body.DisplayName, body.RoleID).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			handlers.Conflict(w, "Tên đăng nhập đã tồn tại")
			return
		}
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true, "id": id})
}

// PUT /api/admin/users/{id}
func UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := roleID(w, r)
	if !ok {
		return
	}
	var body struct {
		DisplayName string `json:"display_name"`
		RoleID      int    `json:"role_id"`
		IsActive    bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	body.DisplayName = strings.TrimSpace(body.DisplayName)
	if len(body.DisplayName) > 100 {
		handlers.BadRequest(w, "Tên hiển thị quá dài")
		return
	}
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	var currentRole int
	var currentSystem, currentActive bool
	err = tx.QueryRow(context.Background(), `
		SELECT u.role_id, r.is_system, u.is_active
		FROM users u
		JOIN "role" r ON r.id = u.role_id
		WHERE u.id = $1
		FOR UPDATE`, id).Scan(&currentRole, &currentSystem, &currentActive)
	if err == pgx.ErrNoRows {
		handlers.NotFound(w)
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	var nextSystem bool
	err = tx.QueryRow(context.Background(), `SELECT is_system FROM "role" WHERE id = $1`, body.RoleID).Scan(&nextSystem)
	if err == pgx.ErrNoRows {
		handlers.BadRequest(w, "Vai trò không tồn tại")
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	leavingLastAdmin := currentSystem && currentActive && (!nextSystem || !body.IsActive)
	if leavingLastAdmin {
		var others int
		if err := tx.QueryRow(context.Background(), `
			SELECT COUNT(*) FROM users u
			JOIN "role" r ON r.id = u.role_id
			WHERE r.is_system AND u.is_active AND u.id <> $1`, id).Scan(&others); err != nil {
			handlers.InternalError(w, err)
			return
		}
		if others == 0 {
			handlers.BadRequest(w, "Phải còn ít nhất một Admin đang hoạt động")
			return
		}
	}
	tag, err := tx.Exec(context.Background(), `
		UPDATE users SET display_name = $1, role_id = $2, is_active = $3 WHERE id = $4`,
		body.DisplayName, body.RoleID, body.IsActive, id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// POST /api/admin/users/{id}/password
func ResetUserPassword(w http.ResponseWriter, r *http.Request) {
	id, ok := roleID(w, r)
	if !ok {
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if len(body.Password) < 6 || len(body.Password) > 100 {
		handlers.BadRequest(w, "Mật khẩu phải từ 6 đến 100 ký tự")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	tag, err := config.DB.Exec(context.Background(),
		`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

func roleExists(w http.ResponseWriter, id int) bool {
	var exists bool
	err := config.DB.QueryRow(context.Background(), `SELECT EXISTS(SELECT 1 FROM "role" WHERE id = $1)`, id).Scan(&exists)
	if err != nil {
		handlers.InternalError(w, err)
		return false
	}
	if !exists {
		handlers.BadRequest(w, "Vai trò không tồn tại")
		return false
	}
	return true
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

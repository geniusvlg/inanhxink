// Package admin contains HTTP handlers for JWT-protected admin API routes.
package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	"inanhxink/backend-golang/internal/middleware"
)

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("dev-secret-change-me")
}

// POST /api/admin/auth/login
func Login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" || body.Password == "" {
		handlers.BadRequest(w, "username and password required")
		return
	}

	var id int
	var username, passwordHash string
	var active bool
	err := config.DB.QueryRow(context.Background(),
		`SELECT id, username, password_hash, is_active FROM users WHERE username = $1`, body.Username).
		Scan(&id, &username, &passwordHash, &active)
	if err != nil {
		handlers.Unauthorized(w, "Invalid credentials")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		handlers.Unauthorized(w, "Invalid credentials")
		return
	}
	if !active {
		handlers.Unauthorized(w, "Tài khoản đã bị khoá")
		return
	}

	principal, err := middleware.LoadPrincipal(r.Context(), id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	claims := middleware.AdminClaims{
		ID:       id,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(8 * time.Hour)),
		},
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{
		"success":  true,
		"token":    token,
		"username": username,
		"user":     publicUser(principal),
	})
}

// GET /api/admin/auth/me
func Me(w http.ResponseWriter, r *http.Request) {
	handlers.OK(w, map[string]any{"success": true, "user": publicUser(middleware.GetAdmin(r))})
}

// PUT /api/admin/auth/profile — the signed-in user changes their own display name.
func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DisplayName string `json:"display_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	name := strings.TrimSpace(body.DisplayName)
	if len(name) > 100 {
		handlers.BadRequest(w, "Tên hiển thị quá dài")
		return
	}
	principal := middleware.GetAdmin(r)
	tag, err := config.DB.Exec(r.Context(),
		`UPDATE users SET display_name = $1 WHERE id = $2 AND is_active`, name, principal.ID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		handlers.Unauthorized(w, "Invalid or expired token")
		return
	}
	principal.DisplayName = name
	handlers.OK(w, map[string]any{"success": true, "user": publicUser(principal)})
}

// POST /api/admin/auth/password — the signed-in user changes their own password.
func ChangePassword(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if body.CurrentPassword == "" || body.NewPassword == "" {
		handlers.BadRequest(w, "current_password and new_password required")
		return
	}
	if len(body.NewPassword) < 6 || len(body.NewPassword) > 100 {
		handlers.BadRequest(w, "Mật khẩu phải từ 6 đến 100 ký tự")
		return
	}
	if body.CurrentPassword == body.NewPassword {
		handlers.BadRequest(w, "Mật khẩu mới phải khác mật khẩu hiện tại")
		return
	}

	principal := middleware.GetAdmin(r)
	var passwordHash string
	err := config.DB.QueryRow(r.Context(),
		`SELECT password_hash FROM users WHERE id = $1 AND is_active`, principal.ID).Scan(&passwordHash)
	if err != nil {
		handlers.Unauthorized(w, "Invalid or expired token")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.CurrentPassword)); err != nil {
		handlers.BadRequest(w, "Mật khẩu hiện tại không đúng")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if _, err := config.DB.Exec(r.Context(),
		`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), principal.ID); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

func publicUser(p *middleware.Principal) map[string]any {
	perms := make([]string, 0, len(p.Permissions))
	for key := range p.Permissions {
		perms = append(perms, key)
	}
	sort.Strings(perms)
	return map[string]any{
		"id":           p.ID,
		"username":     p.Username,
		"display_name": p.DisplayName,
		"is_active":    p.Active,
		"role": map[string]any{
			"id":        p.RoleID,
			"name":      p.RoleName,
			"is_system": p.IsSystem,
		},
		"permissions": perms,
	}
}

// Package admin contains HTTP handlers for JWT-protected admin API routes.
package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
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

	row := config.DB.QueryRow(context.Background(),
		"SELECT id, username, password_hash FROM admin_users WHERE username = $1", body.Username)
	var id int
	var username, passwordHash string
	if err := row.Scan(&id, &username, &passwordHash); err != nil {
		handlers.Unauthorized(w, "Invalid credentials")
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)); err != nil {
		handlers.Unauthorized(w, "Invalid credentials")
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
	handlers.OK(w, map[string]any{"success": true, "token": token, "username": username})
}

// GET /api/admin/auth/me
func Me(w http.ResponseWriter, r *http.Request) {
	admin := middleware.GetAdmin(r)
	handlers.OK(w, map[string]any{"success": true, "admin": map[string]any{
		"id": admin.ID, "username": admin.Username,
	}})
}

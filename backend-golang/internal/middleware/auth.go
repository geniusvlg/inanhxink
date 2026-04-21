package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"inanhxink/backend-golang/internal/handlers"
)

type contextKey string

const AdminKey contextKey = "admin"

// AdminClaims is the JWT payload for admin users.
type AdminClaims struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// RequireAdmin validates the Bearer JWT and injects AdminClaims into the request context.
func RequireAdmin(next http.Handler) http.Handler {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "dev-secret-change-me"
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			handlers.Unauthorized(w, "Missing or invalid Authorization header")
			return
		}
		tokenStr := authHeader[7:]

		claims := &AdminClaims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(secret), nil
		})
		if err != nil || !token.Valid {
			handlers.Unauthorized(w, "Invalid or expired token")
			return
		}

		ctx := context.WithValue(r.Context(), AdminKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAdmin extracts AdminClaims from a request context set by RequireAdmin.
func GetAdmin(r *http.Request) *AdminClaims {
	if v := r.Context().Value(AdminKey); v != nil {
		if c, ok := v.(*AdminClaims); ok {
			return c
		}
	}
	return nil
}

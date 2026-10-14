package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"

	"inanhxink/backend-golang/internal/authz"
	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

type contextKey string

const AdminKey contextKey = "admin"

// AdminClaims is the JWT payload. Permissions are loaded from the database on each request.
type AdminClaims struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// Principal is the signed-in staff account after the role and permissions are loaded.
type Principal struct {
	ID          int
	Username    string
	DisplayName string
	Active      bool
	RoleID      int
	RoleName    string
	IsSystem    bool
	Permissions map[string]struct{}
}

// Can reports whether the account has a catalog permission.
// The system Admin role has every catalog key, even ones added after it was seeded.
func (p *Principal) Can(key string) bool {
	if p == nil {
		return false
	}
	if p.IsSystem && authz.Known(key) {
		return true
	}
	_, ok := p.Permissions[key]
	return ok
}

// HasWrite reports whether the account can create or update anything.
// Used by image cleanup, which is not its own page.
func (p *Principal) HasWrite() bool {
	if p == nil {
		return false
	}
	if p.IsSystem {
		return true
	}
	for key := range p.Permissions {
		if strings.HasSuffix(key, ".create") || strings.HasSuffix(key, ".update") {
			return true
		}
	}
	return false
}

// LoadPrincipal reads the account, role, and permission rows for id.
func LoadPrincipal(ctx context.Context, id int) (*Principal, error) {
	var p Principal
	err := config.DB.QueryRow(ctx, `
		SELECT u.id, u.username, COALESCE(u.display_name, ''), u.is_active,
		       r.id, r.name, r.is_system
		FROM users u
		JOIN "role" r ON r.id = u.role_id
		WHERE u.id = $1`, id).Scan(
		&p.ID, &p.Username, &p.DisplayName, &p.Active,
		&p.RoleID, &p.RoleName, &p.IsSystem,
	)
	if err != nil {
		return nil, err
	}
	p.Permissions = map[string]struct{}{}
	if p.IsSystem {
		for _, key := range authz.AllKeys() {
			p.Permissions[key] = struct{}{}
		}
		return &p, nil
	}
	rows, err := config.DB.Query(ctx, `SELECT permission FROM role_permission WHERE role_id = $1`, p.RoleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		if authz.Known(key) {
			p.Permissions[key] = struct{}{}
		}
	}
	return &p, rows.Err()
}

func jwtSecret() []byte {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s)
	}
	return []byte("dev-secret-change-me")
}

// RequireAdmin validates the Bearer JWT and loads the current role from the database.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := parseToken(w, r)
		if !ok {
			return
		}
		principal, err := LoadPrincipal(r.Context(), claims.ID)
		if err != nil || principal == nil || !principal.Active {
			handlers.Unauthorized(w, "Invalid or expired token")
			return
		}
		ctx := context.WithValue(r.Context(), AdminKey, principal)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireSystemAdmin allows only the seeded Admin role.
func RequireSystemAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !GetAdmin(r).IsSystem {
			handlers.Forbidden(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequirePermission allows the request when the account has any of keys.
func RequirePermission(keys ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p := GetAdmin(r)
			for _, key := range keys {
				if p.Can(key) {
					next.ServeHTTP(w, r)
					return
				}
			}
			handlers.Forbidden(w)
		})
	}
}

// GetAdmin extracts the principal set by RequireAdmin.
func GetAdmin(r *http.Request) *Principal {
	if v := r.Context().Value(AdminKey); v != nil {
		if c, ok := v.(*Principal); ok {
			return c
		}
	}
	return nil
}

// WithAdmin attaches a principal to r. Handlers and tests use it when the JWT
// has already been checked.
func WithAdmin(r *http.Request, p *Principal) *http.Request {
	return r.WithContext(context.WithValue(r.Context(), AdminKey, p))
}

func parseToken(w http.ResponseWriter, r *http.Request) (*AdminClaims, bool) {
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		handlers.Unauthorized(w, "Missing or invalid Authorization header")
		return nil, false
	}
	claims := &AdminClaims{}
	token, err := jwt.ParseWithClaims(authHeader[7:], claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return jwtSecret(), nil
	})
	if err != nil || !token.Valid {
		handlers.Unauthorized(w, "Invalid or expired token")
		return nil, false
	}
	return claims, true
}

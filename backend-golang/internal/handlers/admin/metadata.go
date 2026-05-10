package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	"inanhxink/backend-golang/internal/notify"
)

// GET /api/admin/metadata
func GetMetadata(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT key, value FROM metadata ORDER BY key")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer rows.Close()
	cfg := map[string]string{}
	for rows.Next() {
		var k, v string
		rows.Scan(&k, &v) //nolint
		cfg[k] = v
	}
	redactNotifySMTPPasswordForAdmin(cfg)
	handlers.OK(w, map[string]any{"success": true, "config": cfg})
}

func redactNotifySMTPPasswordForAdmin(cfg map[string]string) {
	if v, ok := cfg[notify.MetaSMTPPass]; ok && strings.TrimSpace(v) != "" {
		cfg["notify_smtp_password_set"] = "true"
	} else {
		cfg["notify_smtp_password_set"] = "false"
	}
	delete(cfg, notify.MetaSMTPPass)
}

// PUT /api/admin/metadata — upsert key/value pairs
func UpsertMetadata(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if len(body) == 0 {
		handlers.OK(w, map[string]any{"success": true})
		return
	}
	for k, v := range body {
		if k == notify.MetaSMTPPass {
			s := strings.TrimSpace(toString(v))
			// Omit or __KEEP__: do not change stored password.
			if s == "" || s == "__KEEP__" {
				continue
			}
			if s == "__CLEAR__" {
				s = ""
			} else {
				s = notify.NormalizeSMTPPass(s)
			}
			if _, err := config.DB.Exec(context.Background(), `
				INSERT INTO metadata (key, value) VALUES ($1, $2)
				ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
				k, s); err != nil {
				handlers.InternalError(w, err)
				return
			}
			continue
		}
		if _, err := config.DB.Exec(context.Background(), `
			INSERT INTO metadata (key, value) VALUES ($1, $2)
			ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
			k, toString(v)); err != nil {
			handlers.InternalError(w, err)
			return
		}
	}
	handlers.OK(w, map[string]any{"success": true})
}

func toString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	default:
		b, _ := json.Marshal(x)
		return string(b)
	}
}

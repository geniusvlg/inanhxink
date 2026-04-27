package admin

import (
	"context"
	"encoding/json"
	"net/http"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
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
	handlers.OK(w, map[string]any{"success": true, "config": cfg})
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

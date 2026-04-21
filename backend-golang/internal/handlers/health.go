package handlers

import (
	"context"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/health
func Health(w http.ResponseWriter, r *http.Request) {
	OK(w, map[string]any{"status": "ok", "message": "Server is running"})
}

// GET /api/test-db
func TestDB(w http.ResponseWriter, r *http.Request) {
	row := config.DB.QueryRow(context.Background(), "SELECT NOW()")
	var ts any
	if err := row.Scan(&ts); err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{"status": "ok", "timestamp": ts})
}

package handlers

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/templates — all active templates (CDN image_url rewritten)
func ListTemplates(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(
		context.Background(),
		"SELECT * FROM templates WHERE is_active = true ORDER BY id ASC",
	)
	if err != nil {
		InternalError(w, err)
		return
	}
	templates, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, row := range templates {
		config.CdnURLField(row, "image_url")
	}
	OK(w, map[string]any{"success": true, "templates": templates})
}

// GET /api/templates/:id
func GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(
		context.Background(),
		"SELECT * FROM templates WHERE id = $1",
		id,
	)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		NotFound(w)
		return
	}
	config.CdnURLField(row, "image_url")
	OK(w, map[string]any{"success": true, "template": row})
}

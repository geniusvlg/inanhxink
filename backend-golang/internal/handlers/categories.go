package handlers

import (
	"context"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/categories?type= — public
func ListCategories(w http.ResponseWriter, r *http.Request) {
	t := r.URL.Query().Get("type")

	var query string
	var args []any

	if t != "" {
		query = "SELECT id, name FROM product_categories WHERE type = $1 ORDER BY name"
		args = []any{t}
	} else {
		query = "SELECT id, name FROM product_categories ORDER BY name"
	}

	rows, err := config.DB.Query(context.Background(), query, args...)
	if err != nil {
		InternalError(w, err)
		return
	}
	categories, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{"success": true, "categories": categories})
}

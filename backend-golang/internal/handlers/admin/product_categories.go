package admin

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/product-categories?type=
func ListProductCategories(w http.ResponseWriter, r *http.Request) {
	t := r.URL.Query().Get("type")
	var rows interface{ Next() bool }
	_ = rows
	if t != "" {
		rs, err := config.DB.Query(context.Background(),
			"SELECT * FROM product_categories WHERE type = $1 ORDER BY name", t)
		if err != nil {
			handlers.InternalError(w, err)
			return
		}
		cats, err := handlers.CollectRows(rs)
		if err != nil {
			handlers.InternalError(w, err)
			return
		}
		handlers.OK(w, map[string]any{"success": true, "categories": cats})
		return
	}
	rs, err := config.DB.Query(context.Background(),
		"SELECT * FROM product_categories ORDER BY type, name")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	cats, err := handlers.CollectRows(rs)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "categories": cats})
}

// POST /api/admin/product-categories
func CreateProductCategory(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if body.Name == "" {
		handlers.BadRequest(w, "name required")
		return
	}
	if body.Type == "" {
		handlers.BadRequest(w, "type required")
		return
	}
	rows, err := config.DB.Query(context.Background(),
		"INSERT INTO product_categories (name, type) VALUES ($1, $2) RETURNING *", body.Name, body.Type)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.Created(w, map[string]any{"success": true, "category": row})
}

// DELETE /api/admin/product-categories/:id
func DeleteProductCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	result, err := config.DB.Exec(context.Background(),
		"DELETE FROM product_categories WHERE id = $1", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if result.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Category deleted"})
}

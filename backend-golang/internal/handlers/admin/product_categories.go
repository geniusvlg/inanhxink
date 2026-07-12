package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

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
		"SELECT * FROM product_categories ORDER BY name")
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
	// Empty type means the category is common across all product types.
	var typeVal any
	if body.Type != "" {
		typeVal = body.Type
	}
	rows, err := config.DB.Query(context.Background(),
		"INSERT INTO product_categories (name, type) VALUES ($1, $2) RETURNING *", body.Name, typeVal)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.Created(w, map[string]any{"success": true, "category": row})
}

// PUT /api/admin/product-categories/:id — partial update; cleans up old S3 image if replaced.
// Only visibility (is_active) and cover image (image_url) are editable here.
func UpdateProductCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var fields map[string]any
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	allowed := map[string]bool{"image_url": true, "is_active": true}
	setClauses := []string{}
	values := []any{}
	i := 1
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		if k == "image_url" {
			if s, ok := v.(string); ok {
				if strings.TrimSpace(s) == "" {
					v = nil
				} else {
					v = strings.TrimSpace(s)
				}
			}
		}
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
		values = append(values, v)
		i++
	}
	if len(setClauses) == 0 {
		handlers.BadRequest(w, "No fields to update")
		return
	}

	var previousImage string
	if _, replacing := fields["image_url"]; replacing {
		config.DB.QueryRow(context.Background(), //nolint
			"SELECT image_url FROM product_categories WHERE id = $1", id).Scan(&previousImage)
	}

	values = append(values, id)
	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf("UPDATE product_categories SET %s WHERE id = $%d RETURNING *",
			joinClauses(setClauses), len(values)),
		values...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}

	if newImg, _ := fields["image_url"].(string); previousImage != "" && previousImage != newImg {
		config.DeleteFromS3(previousImage) //nolint
	}

	handlers.OK(w, map[string]any{"success": true, "category": row})
}

// DELETE /api/admin/product-categories/:id — also removes S3 image (best-effort)
func DeleteProductCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(),
		"DELETE FROM product_categories WHERE id = $1 RETURNING id, image_url", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	if imgURL, ok := row["image_url"].(string); ok && imgURL != "" {
		config.DeleteFromS3(imgURL) //nolint
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Category deleted"})
}

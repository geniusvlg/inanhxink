package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

// Cover image is the admin-uploaded image if set, otherwise the thumbnail of
// the category's best-selling active, non-draft product; product_count only
// counts active, non-draft products. Only visible (is_active) categories show.
const categoriesBaseQuery = `
	SELECT
		pc.id,
		pc.name,
		pc.image_url,
		COALESCE(cnt.product_count, 0) AS product_count,
		cover.thumbnail_url,
		cover.images
	FROM product_categories pc
	LEFT JOIN LATERAL (
		SELECT p.thumbnail_url, p.images
		FROM product_category_map m
		JOIN products p ON p.id = m.product_id
		WHERE m.category_id = pc.id AND p.is_active = true AND p.is_draft = false
		ORDER BY p.sold_count DESC, p.created_at DESC
		LIMIT 1
	) cover ON true
	LEFT JOIN (
		SELECT m.category_id, COUNT(DISTINCT m.product_id) AS product_count
		FROM product_category_map m
		JOIN products p ON p.id = m.product_id
		WHERE p.is_active = true AND p.is_draft = false
		GROUP BY m.category_id
	) cnt ON cnt.category_id = pc.id
	WHERE pc.is_active = true`

// rewriteCategoryCoverCDN collapses image_url/thumbnail_url/images into a
// single cover_image_url, CDN-rewritten. The admin-uploaded image_url takes
// priority; otherwise it falls back to the best-selling product's thumbnail
// (or its first gallery image).
func rewriteCategoryCoverCDN(row map[string]any) {
	if img, ok := row["image_url"].(string); ok && strings.TrimSpace(img) != "" {
		row["cover_image_url"] = config.CdnStr(img)
		delete(row, "image_url")
		delete(row, "thumbnail_url")
		delete(row, "images")
		return
	}
	delete(row, "image_url")

	if thumb, ok := row["thumbnail_url"].(string); !ok || strings.TrimSpace(thumb) == "" {
		if images, ok := row["images"].([]any); ok && len(images) > 0 {
			if first, ok := images[0].(string); ok && strings.TrimSpace(first) != "" {
				row["thumbnail_url"] = first
			}
		}
	}
	config.CdnURLField(row, "thumbnail_url")
	row["cover_image_url"] = row["thumbnail_url"]
	delete(row, "thumbnail_url")
	delete(row, "images")
}

// GET /api/categories?type=&product_type= — public. `type` filters on the
// category's own pc.type scope; `product_type` excludes categories with no
// active, non-draft products of that product type (used by per-type product
// pages so their filter sidebar only lists categories relevant to that page).
func ListCategories(w http.ResponseWriter, r *http.Request) {
	t := r.URL.Query().Get("type")
	productType := r.URL.Query().Get("product_type")

	query := categoriesBaseQuery
	var args []any
	if t != "" {
		args = append(args, t)
		query += fmt.Sprintf(" AND pc.type = $%d", len(args))
	}
	if productType != "" {
		args = append(args, productType)
		query += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM product_category_map m
			JOIN products p ON p.id = m.product_id
			WHERE m.category_id = pc.id AND p.is_active = true AND p.is_draft = false AND p.type = $%d
		)`, len(args))
	}
	query += " ORDER BY pc.name"

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
	for _, c := range categories {
		rewriteCategoryCoverCDN(c)
	}
	OK(w, map[string]any{"success": true, "categories": categories})
}

// GET /api/categories/{id} — public
func GetCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(), categoriesBaseQuery+" AND pc.id = $1", id)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		NotFound(w)
		return
	}
	rewriteCategoryCoverCDN(row)
	OK(w, map[string]any{"success": true, "category": row})
}

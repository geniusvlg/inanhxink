package handlers

import (
	"context"
	"net/http"
	"strconv"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/testimonials — public.
// No query params → ALL rows (backward-compat).
// ?page=N → paginated, uses testimonials_page_size metadata.
func ListTestimonials(w http.ResponseWriter, r *http.Request) {
	pageRaw := r.URL.Query().Get("page")
	if pageRaw == "" {
		// Return all, no pagination
		rows, err := config.DB.Query(context.Background(), `
			SELECT id, image_url, reviewer_name, caption, is_featured, is_featured_on_home
			FROM testimonials
			ORDER BY is_featured DESC, sort_order ASC, created_at DESC`)
		if err != nil {
			InternalError(w, err)
			return
		}
		testimonials, err := CollectRows(rows)
		if err != nil {
			InternalError(w, err)
			return
		}
		for _, t := range testimonials {
			config.CdnURLField(t, "image_url")
		}
		OK(w, map[string]any{"success": true, "testimonials": testimonials})
		return
	}

	page := Clamp(IntParam(pageRaw, 1), 1, 1<<30)

	pageSize := IntParam(r.URL.Query().Get("page_size"), 0)
	if pageSize < 1 {
		meta := config.DB.QueryRow(context.Background(),
			"SELECT value FROM metadata WHERE key = 'testimonials_page_size'")
		var val string
		if err := meta.Scan(&val); err == nil {
			if n, err := strconv.Atoi(val); err == nil {
				pageSize = n
			}
		}
	}
	if pageSize < 1 {
		pageSize = 12
	}
	pageSize = Clamp(pageSize, 1, 60)
	offset := (page - 1) * pageSize

	countRow := config.DB.QueryRow(context.Background(), "SELECT COUNT(*)::text FROM testimonials")
	var countStr string
	if err := countRow.Scan(&countStr); err != nil {
		InternalError(w, err)
		return
	}
	total, _ := strconv.Atoi(countStr)
	totalPages := (total + pageSize - 1) / pageSize
	if totalPages < 1 {
		totalPages = 1
	}

	rows, err := config.DB.Query(context.Background(), `
		SELECT id, image_url, reviewer_name, caption, is_featured, is_featured_on_home
		FROM testimonials
		ORDER BY is_featured DESC, sort_order ASC, created_at DESC
		LIMIT $1 OFFSET $2`, pageSize, offset)
	if err != nil {
		InternalError(w, err)
		return
	}
	testimonials, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, t := range testimonials {
		config.CdnURLField(t, "image_url")
	}
	OK(w, map[string]any{
		"success":      true,
		"testimonials": testimonials,
		"total":        total,
		"page":         page,
		"page_size":    pageSize,
		"total_pages":  totalPages,
	})
}

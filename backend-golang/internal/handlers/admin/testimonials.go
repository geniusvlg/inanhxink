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

// GET /api/admin/testimonials
func ListTestimonials(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT * FROM testimonials ORDER BY is_featured DESC, sort_order ASC, created_at DESC`)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	ts, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "testimonials": ts})
}

// POST /api/admin/testimonials
func CreateTestimonial(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ImageURL          string  `json:"image_url"`
		ReviewerName      *string `json:"reviewer_name"`
		Caption           *string `json:"caption"`
		IsFeatured        bool    `json:"is_featured"`
		IsFeaturedOnHome  bool    `json:"is_featured_on_home"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ImageURL == "" {
		handlers.BadRequest(w, "image_url required")
		return
	}

	nextOrder := config.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM testimonials")
	var next int
	nextOrder.Scan(&next) //nolint

	rows, err := config.DB.Query(context.Background(), `
		INSERT INTO testimonials (image_url, reviewer_name, caption, is_featured, is_featured_on_home, sort_order)
		VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
		body.ImageURL, body.ReviewerName, body.Caption, body.IsFeatured, body.IsFeaturedOnHome, next)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.Created(w, map[string]any{"success": true, "testimonial": row})
}

// POST /api/admin/testimonials/bulk
func BulkCreateTestimonials(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items     []map[string]any `json:"items"`
		ImageURLs []string         `json:"image_urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	type bulkItem struct {
		ImageURL         string
		ReviewerName     *string
		Caption          *string
		IsFeatured       bool
		IsFeaturedOnHome bool
	}

	var items []bulkItem
	if len(body.Items) > 0 {
		for _, it := range body.Items {
			url, _ := it["image_url"].(string)
			if url == "" {
				handlers.BadRequest(w, "each item requires image_url")
				return
			}
			bi := bulkItem{ImageURL: url}
			if v, ok := it["reviewer_name"].(string); ok && strings.TrimSpace(v) != "" {
				bi.ReviewerName = &v
			}
			if v, ok := it["caption"].(string); ok && strings.TrimSpace(v) != "" {
				bi.Caption = &v
			}
			bi.IsFeatured, _ = it["is_featured"].(bool)
			bi.IsFeaturedOnHome, _ = it["is_featured_on_home"].(bool)
			items = append(items, bi)
		}
	} else if len(body.ImageURLs) > 0 {
		for _, u := range body.ImageURLs {
			items = append(items, bulkItem{ImageURL: u})
		}
	} else {
		handlers.BadRequest(w, "items (non-empty array) or image_urls required")
		return
	}

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	var base int
	tx.QueryRow(context.Background(), "SELECT COALESCE(MAX(sort_order), 0) FROM testimonials").Scan(&base) //nolint

	var inserted []map[string]any
	for i, it := range items {
		order := base + i + 1
		rows, err := tx.Query(context.Background(), `
			INSERT INTO testimonials (image_url, reviewer_name, caption, is_featured, is_featured_on_home, sort_order)
			VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
			it.ImageURL, it.ReviewerName, it.Caption, it.IsFeatured, it.IsFeaturedOnHome, order)
		if err != nil {
			handlers.InternalError(w, err)
			return
		}
		row, _ := handlers.CollectOne(rows)
		if row != nil {
			inserted = append(inserted, row)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true, "testimonials": inserted})
}

// PUT /api/admin/testimonials/:id
func UpdateTestimonial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var fields map[string]any
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	allowed := []string{"image_url", "reviewer_name", "caption", "is_featured", "is_featured_on_home"}
	setClauses := []string{}
	values := []any{}
	i := 1
	for _, key := range allowed {
		if v, ok := fields[key]; ok {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
			values = append(values, v)
			i++
		}
	}
	if len(setClauses) == 0 {
		handlers.BadRequest(w, "No fields to update")
		return
	}
	values = append(values, id)

	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf("UPDATE testimonials SET %s WHERE id = $%d RETURNING *",
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
	handlers.OK(w, map[string]any{"success": true, "testimonial": row})
}

// PATCH /api/admin/testimonials/reorder
func ReorderTestimonials(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []struct {
			ID        int `json:"id"`
			SortOrder int `json:"sort_order"`
		} `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Items) == 0 {
		handlers.BadRequest(w, "items array required")
		return
	}

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	for _, it := range body.Items {
		tx.Exec(context.Background(), //nolint
			"UPDATE testimonials SET sort_order = $1 WHERE id = $2", it.SortOrder, it.ID)
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// DELETE /api/admin/testimonials/:id — also removes the S3 image (best-effort)
func DeleteTestimonial(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(),
		"DELETE FROM testimonials WHERE id = $1 RETURNING id, image_url", id)
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
		if _, err := config.DeleteFromS3(imgURL); err != nil {
			// best-effort; log but don't fail
			_ = err
		}
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Testimonial deleted"})
}

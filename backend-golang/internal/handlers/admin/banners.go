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

// GET /api/admin/banners
func ListBanners(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	banners, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "banners": banners})
}

// POST /api/admin/banners
func CreateBanner(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ImageURL string  `json:"image_url"`
		LinkURL  *string `json:"link_url"`
		AltText  *string `json:"alt_text"`
		IsActive *bool   `json:"is_active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ImageURL == "" {
		handlers.BadRequest(w, "image_url required")
		return
	}

	nextRow := config.DB.QueryRow(context.Background(),
		"SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM banners")
	var next int
	nextRow.Scan(&next) //nolint

	isActive := true
	if body.IsActive != nil {
		isActive = *body.IsActive
	}

	cleanLink := nullTrimmed(body.LinkURL)
	cleanAlt := nullTrimmed(body.AltText)

	rows, err := config.DB.Query(context.Background(), `
		INSERT INTO banners (image_url, link_url, alt_text, is_active, sort_order)
		VALUES ($1,$2,$3,$4,$5) RETURNING *`,
		body.ImageURL, cleanLink, cleanAlt, isActive, next)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.Created(w, map[string]any{"success": true, "banner": row})
}

// PUT /api/admin/banners/:id — partial update; cleans up old S3 image if replaced.
func UpdateBanner(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var fields map[string]any
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	allowed := map[string]bool{"image_url": true, "link_url": true, "alt_text": true, "is_active": true}
	setClauses := []string{}
	values := []any{}
	i := 1
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		if k == "link_url" || k == "alt_text" {
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
			"SELECT image_url FROM banners WHERE id = $1", id).Scan(&previousImage)
	}

	values = append(values, id)
	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf("UPDATE banners SET %s WHERE id = $%d RETURNING *",
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

	handlers.OK(w, map[string]any{"success": true, "banner": row})
}

// PATCH /api/admin/banners/reorder
func ReorderBanners(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []struct {
			ID        int `json:"id"`
			SortOrder int `json:"sort_order"`
		} `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
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
			"UPDATE banners SET sort_order = $1 WHERE id = $2", it.SortOrder, it.ID)
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// DELETE /api/admin/banners/:id — also removes S3 image (best-effort)
func DeleteBanner(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(),
		"DELETE FROM banners WHERE id = $1 RETURNING id, image_url", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	if imgURL, ok := row["image_url"].(string); ok {
		config.DeleteFromS3(imgURL) //nolint
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Banner deleted"})
}

func nullTrimmed(s *string) any {
	if s == nil {
		return nil
	}
	t := strings.TrimSpace(*s)
	if t == "" {
		return nil
	}
	return t
}

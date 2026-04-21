package handlers

import (
	"context"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/banners — public, active banners ordered by sort_order.
// image_url is rewritten to CDN.
func ListBanners(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, image_url, link_url, alt_text
		FROM banners
		WHERE is_active = TRUE
		ORDER BY sort_order ASC, created_at DESC`)
	if err != nil {
		InternalError(w, err)
		return
	}
	banners, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, b := range banners {
		config.CdnURLField(b, "image_url")
	}
	OK(w, map[string]any{"success": true, "banners": banners})
}

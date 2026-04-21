package handlers

import (
	"context"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/hero-shots — public, 3 polaroid slots ordered by slot.
// image_url is rewritten to CDN.
func ListHeroShots(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT slot, image_url, caption FROM hero_shots ORDER BY slot ASC`)
	if err != nil {
		InternalError(w, err)
		return
	}
	shots, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, s := range shots {
		config.CdnURLField(s, "image_url")
	}
	OK(w, map[string]any{"success": true, "hero_shots": shots})
}

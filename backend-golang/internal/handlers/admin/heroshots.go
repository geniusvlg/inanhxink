package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/hero-shots
func ListHeroShots(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT slot, image_url, caption, updated_at FROM hero_shots ORDER BY slot ASC")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	shots, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "hero_shots": shots})
}

// PUT /api/admin/hero-shots/:slot
func UpdateHeroShot(w http.ResponseWriter, r *http.Request) {
	slot, err := strconv.Atoi(chi.URLParam(r, "slot"))
	if err != nil || slot < 0 || slot > 2 {
		handlers.BadRequest(w, "slot must be 0, 1, or 2")
		return
	}

	var fields map[string]any
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	allowed := map[string]bool{"image_url": true, "caption": true}
	setClauses := []string{}
	values := []any{}
	i := 1
	for k, v := range fields {
		if !allowed[k] {
			continue
		}
		if k == "image_url" {
			if s, ok := v.(string); ok && s == "" {
				v = nil
			}
		}
		if k == "caption" {
			if s, ok := v.(string); ok {
				t := strings.TrimSpace(s)
				if t == "" {
					v = nil
				} else {
					v = t
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
			"SELECT image_url FROM hero_shots WHERE slot = $1", slot).Scan(&previousImage)
	}

	values = append(values, slot)
	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf("UPDATE hero_shots SET %s WHERE slot = $%d RETURNING slot, image_url, caption, updated_at",
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

	handlers.OK(w, map[string]any{"success": true, "hero_shot": row})
}

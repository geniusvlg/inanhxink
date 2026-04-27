package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/metadata — returns all config as a key/value object.
// Banner slide imageUrls are rewritten to CDN.
func GetMetadata(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), "SELECT key, value FROM metadata")
	if err != nil {
		InternalError(w, err)
		return
	}
	defer rows.Close()

	cfg := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			InternalError(w, err)
			return
		}
		cfg[k] = v
	}
	if err := rows.Err(); err != nil {
		InternalError(w, err)
		return
	}

	rewriteBannerSlides(cfg)
	OK(w, map[string]any{"success": true, "config": cfg})
}

// rewriteBannerSlides rewrites imageUrl inside product_banner_slides and
// product_banner_overrides from S3 origin to the CDN host. Mutates cfg in place.
func rewriteBannerSlides(cfg map[string]string) {
	rewriteList := func(raw string) string {
		var slides []map[string]any
		if err := json.Unmarshal([]byte(raw), &slides); err != nil {
			return raw
		}
		for _, s := range slides {
			if url, ok := s["imageUrl"].(string); ok {
				s["imageUrl"] = config.CdnStr(url)
			}
		}
		if b, err := json.Marshal(slides); err == nil {
			return string(b)
		}
		return raw
	}

	if raw, ok := cfg["product_banner_slides"]; ok {
		cfg["product_banner_slides"] = rewriteList(raw)
	}

	if raw, ok := cfg["product_banner_overrides"]; ok {
		var obj map[string]any
		if err := json.Unmarshal([]byte(raw), &obj); err == nil {
			for _, entry := range obj {
				if e, ok := entry.(map[string]any); ok {
					if slides, ok := e["slides"].([]any); ok {
						for _, slide := range slides {
							if s, ok := slide.(map[string]any); ok {
								if url, ok := s["imageUrl"].(string); ok {
									s["imageUrl"] = config.CdnStr(url)
								}
							}
						}
					}
				}
			}
			if b, err := json.Marshal(obj); err == nil {
				cfg["product_banner_overrides"] = string(b)
			}
		}
	}
}

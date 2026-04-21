package handlers

import (
	"context"
	"net/http"
	"os"
	"strings"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/site-data — returns template_type and template_data for a subdomain.
// CDN URLs are rewritten inside template_data before the response.
func SiteData(w http.ResponseWriter, r *http.Request) {
	subdomain := getSubdomain(r)
	if subdomain == "" {
		JSON(w, 400, map[string]any{
			"error": "No subdomain detected. On localhost use ?sub=NAME or ?preview=NAME.",
		})
		return
	}

	row := config.DB.QueryRow(
		context.Background(),
		"SELECT template_type, template_data FROM qr_codes WHERE qr_name = $1",
		subdomain,
	)

	var templateType string
	var templateData map[string]any
	if err := row.Scan(&templateType, &templateData); err != nil {
		JSON(w, 404, map[string]any{"error": "Site '" + subdomain + "' not found"})
		return
	}

	if templateData != nil {
		if v, ok := templateData["musicUrl"].(string); ok {
			templateData["musicUrl"] = config.CdnStr(v)
		}
		if arr, ok := templateData["imageUrls"].([]any); ok {
			for i, item := range arr {
				if s, ok := item.(string); ok {
					arr[i] = config.CdnStr(s)
				}
			}
		}
	}

	OK(w, map[string]any{
		"template_type": templateType,
		"template_data": templateData,
	})
}

// getSubdomain extracts the subdomain from the request host or query param (dev mode).
func getSubdomain(r *http.Request) string {
	host := r.Host
	domain := domainFromEnv()

	isLocal := strings.HasPrefix(host, "localhost") || strings.HasPrefix(host, "127.0.0.1")

	if isLocal {
		if p := r.URL.Query().Get("preview"); p != "" {
			return p
		}
		if p := r.URL.Query().Get("sub"); p != "" {
			return p
		}
		// Check Referer header for asset requests from the template page
		referer := r.Header.Get("Referer")
		if referer != "" {
			if idx := strings.Index(referer, "preview="); idx != -1 {
				rest := referer[idx+8:]
				if end := strings.IndexAny(rest, "&# "); end != -1 {
					rest = rest[:end]
				}
				return rest
			}
			if idx := strings.Index(referer, "sub="); idx != -1 {
				rest := referer[idx+4:]
				if end := strings.IndexAny(rest, "&# "); end != -1 {
					rest = rest[:end]
				}
				return rest
			}
		}
		return ""
	}

	// Production: first label of Host header
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return ""
	}
	sub := parts[0]
	if sub == "" || sub == "store" || sub == "www" || sub == domain {
		return ""
	}
	return sub
}

func domainFromEnv() string {
	if d := os.Getenv("DOMAIN"); d != "" {
		return d
	}
	return "inanhxink.com"
}

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
			"error": "No subdomain detected. On localhost or ngrok use ?sub=NAME or ?preview=NAME.",
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
		rewriteTemplateDataCDN(templateData)
	}

	OK(w, map[string]any{
		"template_type": templateType,
		"template_data": templateData,
	})
}

func rewriteTemplateDataCDN(data map[string]any) {
	for _, key := range []string{"musicUrl", "avatarFrom", "avatarTo", "boyImage", "girlImage"} {
		if v, ok := data[key].(string); ok {
			data[key] = config.CdnStr(v)
		}
	}
	for _, key := range []string{"imageUrls", "popupImages"} {
		if arr, ok := data[key].([]any); ok {
			for i, item := range arr {
				if s, ok := item.(string); ok {
					arr[i] = config.CdnStr(s)
				}
			}
		}
	}
}

// hostWithoutPort strips :port from r.Host (e.g. localhost:3001 → localhost).
func hostWithoutPort(host string) string {
	if i := strings.LastIndex(host, ":"); i > 0 && strings.Index(host, "]") < 0 {
		return host[:i]
	}
	return host
}

// isDevOrTunnelHost is true for localhost and tunnel URLs (ngrok, etc.) where the
// first hostname label is NOT a customer QR subdomain.
func isDevOrTunnelHost(host string) bool {
	h := strings.ToLower(hostWithoutPort(host))
	if strings.HasPrefix(h, "localhost") || strings.HasPrefix(h, "127.0.0.1") {
		return true
	}
	return strings.HasSuffix(h, ".ngrok-free.app") ||
		strings.HasSuffix(h, ".ngrok.io") ||
		strings.HasSuffix(h, ".ngrok.app") ||
		strings.Contains(h, ".ngrok")
}

// getSubdomain extracts the subdomain from the request host or query param (dev mode).
func getSubdomain(r *http.Request) string {
	host := r.Host
	domain := domainFromEnv()

	if isDevOrTunnelHost(host) {
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

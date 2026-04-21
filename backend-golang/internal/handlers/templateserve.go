package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"inanhxink/backend-golang/internal/config"
)

var templatesRoot string

func init() {
	// Resolves relative to CWD; adjust if needed for production.
	templatesRoot = "public/templates"
}

// ServeTemplate is the catch-all handler that serves HTML template pages for
// *.inanhxink.com subdomains (or ?preview= on localhost).
func ServeTemplate(w http.ResponseWriter, r *http.Request) {
	subdomain := getSubdomain(r)
	if subdomain == "" {
		http.NotFound(w, r)
		return
	}

	urlPath := r.URL.Path

	row := config.DB.QueryRow(context.Background(),
		"SELECT template_type, template_data FROM qr_codes WHERE qr_name = $1", subdomain)
	var templateType string
	var templateData map[string]any
	if err := row.Scan(&templateType, &templateData); err != nil {
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprintf(w, "<h1>404 – '%s' not found</h1>", subdomain)
		return
	}

	templateDir := filepath.Join(templatesRoot, templateType)

	// Serve static assets directly from the template folder
	if urlPath != "/" && urlPath != "" {
		assetPath := filepath.Join(templateDir, urlPath)
		safeBase := filepath.Clean(templateDir) + string(filepath.Separator)
		resolved := filepath.Clean(assetPath)
		if !strings.HasPrefix(resolved, safeBase) {
			w.WriteHeader(http.StatusForbidden)
			fmt.Fprint(w, "Forbidden")
			return
		}
		info, err := os.Stat(resolved)
		if err == nil && !info.IsDir() {
			http.ServeFile(w, r, resolved)
			return
		}
	}

	// Serve index.html with injected globals
	indexPath := filepath.Join(templateDir, "index.html")
	htmlBytes, err := os.ReadFile(indexPath)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprintf(w, "Template not found: %s", templateType)
		return
	}

	html := injectScripts(string(htmlBytes), subdomain, templateType, templateData)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	fmt.Fprint(w, html)
}

func injectScripts(html, subdomain, templateType string, templateData map[string]any) string {
	data := map[string]any{}
	if templateData != nil {
		for k, v := range templateData {
			data[k] = v
		}
	}
	// Rewrite S3 → CDN URLs in template data before injection
	if v, ok := data["musicUrl"].(string); ok {
		data["musicUrl"] = config.CdnStr(v)
	}
	if arr, ok := data["imageUrls"].([]any); ok {
		for i, item := range arr {
			if s, ok := item.(string); ok {
				arr[i] = config.CdnStr(s)
			}
		}
	}
	if v, ok := data["avatarFrom"].(string); ok {
		data["avatarFrom"] = config.CdnStr(v)
	}
	if v, ok := data["avatarTo"].(string); ok {
		data["avatarTo"] = config.CdnStr(v)
	}

	dataPayload, _ := json.Marshal(map[string]any{"template": templateType, "data": data})
	subdomainJSON, _ := json.Marshal(subdomain)
	tag := fmt.Sprintf(
		"<script>window.__SUBDOMAIN__=%s;window.dataFromSubdomain=%s;</script>",
		string(subdomainJSON), string(dataPayload),
	)
	return strings.Replace(html, "</head>", tag+"\n</head>", 1)
}

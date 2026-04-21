package handlers

import (
	"context"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

// GET /api/qrcodes/:qrName
func GetQRCode(w http.ResponseWriter, r *http.Request) {
	qrName := strings.ToLower(chi.URLParam(r, "qrName"))

	rows, err := config.DB.Query(context.Background(), `
		SELECT qr.*, t.name AS template_name, t.description AS template_description,
			t.image_url AS template_image_url, t.price AS template_price
		FROM qr_codes qr
		LEFT JOIN templates t ON qr.template_id = t.id
		WHERE qr.qr_name = $1`, qrName)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		JSON(w, 404, map[string]any{"success": false, "error": "QR code not found"})
		return
	}

	content, _ := row["content"].(string)
	var contentLines []string
	for _, line := range strings.Split(content, "\n") {
		if strings.TrimSpace(line) != "" {
			contentLines = append(contentLines, strings.TrimSpace(line))
		}
	}

	var templateImgURL any
	if v, ok := row["template_image_url"].(string); ok {
		templateImgURL = config.CdnStr(v)
	}

	OK(w, map[string]any{
		"success": true,
		"qrCode": map[string]any{
			"id":           row["id"],
			"qrName":       row["qr_name"],
			"fullUrl":      row["full_url"],
			"content":      content,
			"contentLines": contentLines,
			"template": map[string]any{
				"id":          row["template_id"],
				"name":        row["template_name"],
				"description": row["template_description"],
				"imageUrl":    templateImgURL,
				"price":       row["template_price"],
			},
			"createdAt": row["created_at"],
		},
	})
}

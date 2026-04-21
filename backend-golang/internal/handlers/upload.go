package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"inanhxink/backend-golang/internal/config"
)

const maxUploadSize = 50 * 1024 * 1024 // 50 MB

var allowedMimes = map[string]bool{
	"image/jpeg":  true,
	"image/png":   true,
	"image/gif":   true,
	"image/webp":  true,
	"image/tiff":  true,
	"audio/mpeg":  true,
	"audio/mp4":   true,
	"audio/webm":  true,
	"audio/ogg":   true,
	"audio/opus":  true,
	"audio/wav":   true,
}

// POST /api/upload
// Multipart form: files[] + ?qrName= or ?prefix= and ?watermark=true
func Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"success": false,
			"error":   "Ảnh quá lớn. Kích thước tối đa là 50MB mỗi ảnh.",
		})
		return
	}

	files := r.MultipartForm.File["files"]
	if len(files) == 0 {
		BadRequest(w, "No files uploaded")
		return
	}

	qrName := sanitizePathSegments(r.URL.Query().Get("qrName"))
	prefix := sanitizePathSegments(r.URL.Query().Get("prefix"))
	watermark := r.URL.Query().Get("watermark") == "true"

	folder := prefix
	if folder == "" {
		if qrName != "" {
			folder = "uploads/" + qrName
		} else {
			folder = "uploads"
		}
	}

	var urls []string
	for _, fh := range files {
		if fh.Size > maxUploadSize {
			JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
				"success": false,
				"error":   "Ảnh quá lớn. Kích thước tối đa là 50MB mỗi ảnh.",
			})
			return
		}

		f, err := fh.Open()
		if err != nil {
			InternalError(w, err)
			return
		}
		defer f.Close()

		buf, err := io.ReadAll(f)
		if err != nil {
			InternalError(w, fmt.Errorf("read file: %w", err))
			return
		}

		mimetype := fh.Header.Get("Content-Type")
		if !allowedMimes[mimetype] {
			BadRequest(w, "Only image and audio files are allowed")
			return
		}

		url, err := config.UploadToS3(buf, folder, fh.Filename, mimetype, watermark)
		if err != nil {
			InternalError(w, err)
			return
		}
		urls = append(urls, url)
	}

	OK(w, map[string]any{"success": true, "urls": urls})
}

func sanitizePathSegments(s string) string {
	parts := strings.Split(strings.ToLower(s), "/")
	var clean []string
	for _, seg := range parts {
		var b strings.Builder
		for _, ch := range seg {
			if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' {
				b.WriteRune(ch)
			}
		}
		if b.Len() > 0 {
			clean = append(clean, b.String())
		}
	}
	return strings.Join(clean, "/")
}

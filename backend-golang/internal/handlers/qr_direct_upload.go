package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/config"
)

const maxQRImageUploadSize = 10 * 1024 * 1024

type qrUploadSignRequest struct {
	QRName      string `json:"qrName"`
	Kind        string `json:"kind"`
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
}

var voiceExtensionByMIME = map[string]string{
	"audio/mp4":  ".m4a",
	"audio/webm": ".webm",
	"audio/ogg":  ".ogg",
	"audio/opus": ".opus",
	"audio/mpeg": ".mp3",
	"audio/wav":  ".wav",
}

// SignQRUpload returns a short-lived URL for uploading a processed QR image or
// voice recording directly from the browser to the QR's temporary S3 folder.
func SignQRUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	var body qrUploadSignRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "Invalid JSON body")
		return
	}

	qrName := strings.ToLower(strings.TrimSpace(body.QRName))
	if !voiceQRNameRe.MatchString(qrName) {
		BadRequest(w, "Tên QR không hợp lệ")
		return
	}

	var existingID int
	err := config.DB.QueryRow(r.Context(),
		"SELECT id FROM qr_codes WHERE qr_name = $1", qrName).Scan(&existingID)
	if err == nil {
		JSON(w, http.StatusConflict, map[string]any{"success": false, "error": "Tên QR đã được sử dụng"})
		return
	}
	if err != pgx.ErrNoRows {
		InternalError(w, err)
		return
	}

	contentType := strings.ToLower(strings.TrimSpace(strings.Split(body.ContentType, ";")[0]))
	var extension string
	switch body.Kind {
	case "image":
		if contentType != "image/webp" {
			BadRequest(w, "Ảnh QR phải được xử lý thành WebP trước khi tải lên")
			return
		}
		if body.Size <= 0 || body.Size > maxQRImageUploadSize {
			JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
				"success": false,
				"error":   "Ảnh vượt quá giới hạn 10 MB",
			})
			return
		}
		extension = ".webp"
	case "voice":
		if !voiceMimes[contentType] {
			BadRequest(w, "Định dạng ghi âm không được hỗ trợ")
			return
		}
		if body.Size <= 0 || body.Size > maxVoiceRecordingSize {
			JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
				"success": false,
				"error":   "Bản ghi âm vượt quá giới hạn 10 MB",
			})
			return
		}
		extension = voiceExtensionByMIME[contentType]
	default:
		BadRequest(w, "Loại tệp QR không hợp lệ")
		return
	}

	tokenBytes := make([]byte, 8)
	if _, err := rand.Read(tokenBytes); err != nil {
		InternalError(w, fmt.Errorf("generate upload token: %w", err))
		return
	}
	key := fmt.Sprintf(
		"uploads/temp/%s/%d-%s%s",
		qrName,
		time.Now().UnixMilli(),
		hex.EncodeToString(tokenBytes),
		extension,
	)
	signed, err := config.PresignPutObject(r.Context(), key, contentType)
	if err != nil {
		InternalError(w, err)
		return
	}

	OK(w, map[string]any{
		"success":   true,
		"uploadUrl": signed.URL,
		"publicUrl": signed.PublicURL,
		"headers":   signed.Headers,
	})
}

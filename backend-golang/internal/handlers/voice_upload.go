package handlers

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/config"
)

const maxVoiceRecordingSize = 5 * 1024 * 1024

var (
	voiceQRNameRe = regexp.MustCompile(`^[a-z0-9_-]+$`)
	voiceMimes    = map[string]bool{
		"audio/mp4":  true,
		"audio/webm": true,
		"audio/ogg":  true,
		"audio/opus": true,
		"audio/mpeg": true,
		"audio/wav":  true,
	}
)

// UploadVoiceRecording stores one short browser recording in the QR's temporary
// folder. CreateOrder validates this URL again before attaching it to an order.
func UploadVoiceRecording(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxVoiceRecordingSize+1024*1024)
	if err := r.ParseMultipartForm(maxVoiceRecordingSize); err != nil {
		JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"success": false,
			"error":   "Bản ghi âm vượt quá giới hạn 5 MB",
		})
		return
	}

	qrName := strings.ToLower(strings.TrimSpace(r.FormValue("qrName")))
	if !voiceQRNameRe.MatchString(qrName) {
		BadRequest(w, "Tên QR không hợp lệ")
		return
	}

	var existingID int
	err := config.DB.QueryRow(context.Background(),
		"SELECT id FROM qr_codes WHERE qr_name = $1", qrName).Scan(&existingID)
	if err == nil {
		JSON(w, http.StatusConflict, map[string]any{"success": false, "error": "Tên QR đã được sử dụng"})
		return
	}
	if err != pgx.ErrNoRows {
		InternalError(w, err)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		BadRequest(w, "Thiếu tệp ghi âm")
		return
	}
	defer file.Close()

	mimeType := strings.ToLower(strings.TrimSpace(strings.Split(header.Header.Get("Content-Type"), ";")[0]))
	if !voiceMimes[mimeType] {
		BadRequest(w, "Định dạng ghi âm không được hỗ trợ")
		return
	}

	buf, err := io.ReadAll(io.LimitReader(file, maxVoiceRecordingSize+1))
	if err != nil {
		InternalError(w, fmt.Errorf("read voice recording: %w", err))
		return
	}
	if len(buf) == 0 {
		BadRequest(w, "Tệp ghi âm trống")
		return
	}
	if len(buf) > maxVoiceRecordingSize {
		JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"success": false,
			"error":   "Bản ghi âm vượt quá giới hạn 5 MB",
		})
		return
	}

	rawURL, err := config.UploadToS3(
		buf,
		"uploads/temp/"+qrName,
		header.Filename,
		mimeType,
		false,
		true,
	)
	if err != nil {
		InternalError(w, err)
		return
	}

	OK(w, map[string]any{"success": true, "url": rawURL})
}

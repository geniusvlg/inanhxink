package handlers

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"inanhxink/backend-golang/internal/config"
)

const maxMusicBytes = 15 * 1024 * 1024 // 15 MB

// POST /api/music/extract — downloads audio from a URL via yt-dlp and uploads to S3.
func ExtractMusic(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URL    string `json:"url"`
		QRName string `json:"qrName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.URL) == "" {
		BadRequest(w, "URL is required")
		return
	}

	uploadedURL, err := downloadAndUploadMusic(strings.TrimSpace(body.URL), body.QRName)
	if err != nil {
		JSON(w, 400, map[string]any{"success": false, "error": err.Error()})
		return
	}
	OK(w, map[string]any{"success": true, "url": uploadedURL})
}

func downloadAndUploadMusic(url, qrName string) (string, error) {
	safeName := sanitizeName(qrName)
	if safeName == "" {
		safeName = "music"
	}

	tmpDir, err := os.MkdirTemp("", fmt.Sprintf("music-check-%s-", safeName))
	if err != nil {
		return "", fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	outPattern := filepath.Join(tmpDir, "music.%(ext)s")
	cmd := exec.Command("yt-dlp", "-x", "-o", outPattern, url)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("yt-dlp error: %s", string(out))
	}

	var musicFile string
	err = filepath.WalkDir(tmpDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasPrefix(d.Name(), "music.") {
			musicFile = path
		}
		return nil
	})
	if err != nil || musicFile == "" {
		return "", fmt.Errorf("Không tìm thấy file nhạc sau khi tải")
	}

	buf, err := os.ReadFile(musicFile)
	if err != nil {
		return "", fmt.Errorf("read music file: %w", err)
	}
	if len(buf) > maxMusicBytes {
		return "", fmt.Errorf("File nhạc quá lớn (tối đa 15MB)")
	}

	ext := strings.ToLower(filepath.Ext(musicFile))
	mimetype := audioMimeFor(ext)

	return config.UploadToS3(buf, "uploads/"+safeName, filepath.Base(musicFile), mimetype, false)
}

func audioMimeFor(ext string) string {
	m := map[string]string{
		".m4a":  "audio/mp4",
		".mp3":  "audio/mpeg",
		".webm": "audio/webm",
		".ogg":  "audio/ogg",
		".opus": "audio/opus",
		".wav":  "audio/wav",
	}
	if v, ok := m[ext]; ok {
		return v
	}
	return "audio/mpeg"
}

func sanitizeName(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, ch := range s {
		if (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' {
			b.WriteRune(ch)
		}
	}
	return b.String()
}

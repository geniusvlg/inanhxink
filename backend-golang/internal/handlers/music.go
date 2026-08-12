package handlers

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"inanhxink/backend-golang/internal/config"
)

const maxMusicBytes = 15 * 1024 * 1024 // 15 MB

// TikTok serves a JS anti-bot challenge page to yt-dlp's default HTTP
// User-Agent (yt-dlp can't solve it and fails with "Unexpected response
// from webpage request"), but serves the real page straight away to an
// ordinary browser UA. Spoofing one here fixes TikTok links without any
// other change; it's harmless for YouTube/other sources too. Keep this
// reasonably current — TikTok's anti-bot check is sensitive to stale UAs.
const musicDownloadUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"

// TikTok "photo" posts (slideshow + music, no real video stream) resolve to
// a /photo/<id> URL that yt-dlp's TikTok extractor doesn't recognize at all —
// it falls back to the generic extractor and errors "Unsupported URL"
// (see https://github.com/yt-dlp/yt-dlp/issues/15764, still open). The
// underlying post ID still has a real audio track reachable at the same
// numeric ID under /video/, so on that specific failure we retry once with
// the path rewritten before giving up.
var tiktokPhotoURLPattern = regexp.MustCompile(`https?://(?:www\.)?tiktok\.com/(@[\w.-]+)/photo/(\d+)`)

// Recognized failure signature from yt-dlp's stderr, used to turn a wall of
// Python traceback into a short Vietnamese message for the order form
// instead of dumping raw tool output at customers.
var ytdlpAntiBotSignature = regexp.MustCompile(`(?i)Unexpected response from webpage request|Unable to extract (?:webpage|universal) (?:video )?data|Unable to solve JS challenge|Unable to extract challenge data`)

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
	out, err := extractWithRetries(outPattern, url)
	// What actually determines the customer-facing message: defaults to the
	// direct attempt, but gets replaced with the /video/ rewrite's own result
	// below once that's attempted, so a transient anti-bot block on the
	// rewrite is classified from its own output rather than the original
	// "Unsupported URL" text.
	classifyOut := out
	if err != nil {
		// A TikTok photo/slideshow post: retry against the equivalent
		// /video/ URL, which often still yields the post's audio track even
		// though yt-dlp can't handle /photo/ URLs directly.
		if m := tiktokPhotoURLPattern.FindStringSubmatch(string(out)); m != nil {
			retryURL := "https://www.tiktok.com/" + m[1] + "/video/" + m[2]
			log.Printf("[music-extract] tiktok photo post detected, retrying as video: %s", retryURL)
			retryOut, retryErr := extractWithRetries(outPattern, retryURL)
			if retryErr == nil {
				out, err = retryOut, nil
			} else {
				out = append(out, []byte("\n---retry---\n")...)
				out = append(out, retryOut...)
				classifyOut = retryOut
			}
		}
	}
	if err != nil {
		log.Printf("[music-extract] yt-dlp failed for %s: %s", url, string(out))
		return "", friendlyYtDlpError(string(classifyOut))
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

	return config.UploadToS3(buf, "uploads/"+safeName, filepath.Base(musicFile), mimetype, false, false)
}

func runYtDlp(outPattern, url string) ([]byte, error) {
	cmd := exec.Command("yt-dlp", "--user-agent", musicDownloadUserAgent, "-x", "-o", outPattern, url)
	return cmd.CombinedOutput()
}

// TikTok's JS anti-bot challenge is flaky in practice — a link that errors
// with "Unexpected response from webpage request" on one attempt often
// succeeds moments later with no other change (observed: customers hitting
// "Kiểm tra" a second time after a failure routinely get through). So retry
// automatically here rather than making the customer notice and retry by
// hand. Only anti-bot-looking failures are retried; anything else (bad URL,
// unsupported photo post, etc.) returns immediately since retrying won't help.
//
// The backoff is deliberately several seconds, not milliseconds: a tight
// retry loop tends to hit the same still-warm block, whereas the real-world
// gap before a customer notices a failure and clicks "Kiểm tra" again is
// what actually gives TikTok's challenge time to clear.
var musicExtractBackoff = []time.Duration{3 * time.Second, 6 * time.Second}

func extractWithRetries(outPattern, url string) ([]byte, error) {
	var out []byte
	var err error
	maxAttempts := len(musicExtractBackoff) + 1
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		out, err = runYtDlp(outPattern, url)
		if err == nil {
			return out, nil
		}
		if !ytdlpAntiBotSignature.Match(out) || attempt == maxAttempts {
			break
		}
		wait := musicExtractBackoff[attempt-1]
		log.Printf("[music-extract] anti-bot challenge on attempt %d/%d for %s, retrying in %s", attempt, maxAttempts, url, wait)
		time.Sleep(wait)
	}
	return out, err
}

// friendlyYtDlpError turns yt-dlp's raw (often multi-hundred-line) stderr
// dump into a short Vietnamese message safe to show on the order form. The
// full output is always logged server-side separately for debugging.
func friendlyYtDlpError(out string) error {
	switch {
	case ytdlpAntiBotSignature.MatchString(out):
		return fmt.Errorf("TikTok đang tạm chặn yêu cầu tải nhạc tự động. Vui lòng thử lại sau vài phút, hoặc thử một video khác.")
	default:
		return fmt.Errorf("Không tải được nhạc từ link này. Vui lòng kiểm tra lại link hoặc thử video khác.")
	}
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

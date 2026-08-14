package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const musicDownloadUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"

var (
	tiktokIDPattern        = regexp.MustCompile(`(?i)(?:video|photo|embed(?:/v2)?)/(\d{8,})`)
	tiktokShortHostPattern = regexp.MustCompile(`(?i)^https?://(?:vm|vt)\.tiktok\.com/|^https?://(?:www\.)?tiktok\.com/t/`)
	tiktokHostPattern      = regexp.MustCompile(`(?i)(?:^|\.)tiktok\.com/`)
	tiktokPhotoURLPattern  = regexp.MustCompile(`(?i)https?://(?:www\.)?tiktok\.com/(@[\w.-]+)/photo/(\d+)`)
	frontityStatePattern   = regexp.MustCompile(`(?s)id="__FRONTITY_CONNECT_STATE__"[^>]*>(.*?)</script>`)
)

func isTikTokURL(raw string) bool {
	return tiktokHostPattern.MatchString(raw)
}

func tiktokEmbedURL(postID string) string {
	return "https://www.tiktok.com/embed/v2/" + postID
}

func rewriteTikTokPhotoURL(raw string) string {
	m := tiktokPhotoURLPattern.FindStringSubmatch(raw)
	if m == nil {
		return raw
	}
	return "https://www.tiktok.com/" + m[1] + "/video/" + m[2]
}

func tiktokPostID(raw string) string {
	if m := tiktokIDPattern.FindStringSubmatch(raw); m != nil {
		return m[1]
	}
	if tiktokShortHostPattern.MatchString(raw) {
		if m := tiktokIDPattern.FindStringSubmatch(resolveRedirectURL(raw)); m != nil {
			return m[1]
		}
	}
	return ""
}

func resolveRedirectURL(raw string) string {
	client := &http.Client{
		Timeout: 12 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 8 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
	req, err := http.NewRequest(http.MethodGet, raw, nil)
	if err != nil {
		return raw
	}
	applyTikTokHeaders(req, "")
	resp, err := client.Do(req)
	if err != nil {
		return raw
	}
	defer resp.Body.Close()
	if resp.Request != nil && resp.Request.URL != nil {
		return resp.Request.URL.String()
	}
	if loc := resp.Header.Get("Location"); loc != "" {
		return loc
	}
	return raw
}

func applyTikTokHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", musicDownloadUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,vi;q=0.8")
	req.Header.Set("Sec-Ch-Ua", `"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"macOS"`)
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "same-origin")
	if referer == "" {
		referer = "https://www.tiktok.com/"
	}
	req.Header.Set("Referer", referer)
}

func curlAvailable() bool {
	_, err := exec.LookPath("curl")
	return err == nil
}

func curlGetTo(rawURL, dest, cookieFile, referer string, timeoutSec int) (int, error) {
	args := []string{
		"-sS", "-L", "--max-time", strconv.Itoa(timeoutSec),
		"-A", musicDownloadUserAgent,
		"-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		"-H", "Accept-Language: en-US,en;q=0.9,vi;q=0.8",
		"-o", dest, "-w", "%{http_code}",
	}
	if cookieFile != "" {
		args = append(args, "-c", cookieFile, "-b", cookieFile)
	}
	if referer != "" {
		args = append(args, "-e", referer)
	}
	cmd := exec.Command("curl", args...)
	cmd.Args = append(cmd.Args, rawURL)
	out, err := cmd.Output()
	code, _ := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil && code == 0 {
		return 0, err
	}
	return code, nil
}

func curlDownloadFile(rawURL, dest, cookieFile, referer string) error {
	args := []string{
		"-sS", "-L", "--fail", "--max-time", "45",
		"--max-filesize", strconv.Itoa(maxMusicBytes),
		"-A", musicDownloadUserAgent,
		"-o", dest,
	}
	if cookieFile != "" {
		args = append(args, "-c", cookieFile, "-b", cookieFile)
	}
	if referer != "" {
		args = append(args, "-e", referer)
	}
	cmd := exec.Command("curl", args...)
	cmd.Args = append(cmd.Args, rawURL)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("curl media: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

func warmTikTokSession(client *http.Client, cookieFile string) {
	if curlAvailable() && cookieFile != "" {
		home := cookieFile + ".home.html"
		defer os.Remove(home)
		if _, err := curlGetTo("https://www.tiktok.com/", home, cookieFile, "", 15); err != nil {
			log.Printf("[music-extract] tiktok curl warmup failed: %v", err)
		}
		return
	}
	req, err := http.NewRequest(http.MethodGet, "https://www.tiktok.com/", nil)
	if err != nil {
		return
	}
	applyTikTokHeaders(req, "")
	resp, err := client.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
}

func newTikTokClient() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{
		Timeout: 25 * time.Second,
		Jar:     jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 8 {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}
}

// downloadTikTokViaEmbed uses TikTok's embed page, which still includes the
// signed audio URL after the regular /video/ HTML stopped shipping
// __UNIVERSAL_DATA_FOR_REHYDRATION__ (the blob yt-dlp's extractor needs).
// Go's net/http TLS fingerprint is often 503'd, so HTML/media fetches prefer
// curl (already in the Docker image) with a warmed cookie jar.
func downloadTikTokViaEmbed(tmpDir, sourceURL, postID string) (string, error) {
	client := newTikTokClient()
	cookieFile := filepath.Join(tmpDir, ".tiktok-cookies")
	warmTikTokSession(client, cookieFile)
	var lastErr error
	for attempt, wait := range []time.Duration{0, 2 * time.Second, 4 * time.Second} {
		if wait > 0 {
			time.Sleep(wait)
		}
		html, err := fetchTikTokEmbed(client, tmpDir, postID, cookieFile)
		if err != nil {
			lastErr = err
			log.Printf("[music-extract] tiktok embed fetch attempt %d failed: %v", attempt+1, err)
			continue
		}
		playURL, videoURL := parseTikTokEmbedMedia(html)
		if playURL != "" {
			path, err := downloadTikTokMedia(client, tmpDir, playURL, "music", cookieFile)
			if err == nil {
				return path, nil
			}
			lastErr = err
			log.Printf("[music-extract] tiktok audio url download failed: %v", err)
		}
		if videoURL != "" {
			path, err := downloadTikTokVideoAudio(client, tmpDir, videoURL, cookieFile)
			if err == nil {
				return path, nil
			}
			lastErr = err
			log.Printf("[music-extract] tiktok video-audio fallback failed: %v", err)
		}
		if playURL == "" && videoURL == "" {
			lastErr = fmt.Errorf("embed page had no audio or video url")
		}
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("tiktok embed extract failed for %s", sourceURL)
	}
	return "", lastErr
}

func fetchTikTokEmbed(client *http.Client, tmpDir, postID, cookieFile string) (string, error) {
	embedURL := tiktokEmbedURL(postID)
	if curlAvailable() {
		dest := filepath.Join(tmpDir, "embed.html")
		code, err := curlGetTo(embedURL, dest, cookieFile, "https://www.tiktok.com/", 25)
		if err != nil {
			return "", err
		}
		body, readErr := os.ReadFile(dest)
		if readErr != nil {
			return "", readErr
		}
		return embedHTMLOrError(string(body), code)
	}
	return fetchTikTokEmbedHTTP(client, postID)
}

func fetchTikTokEmbedHTTP(client *http.Client, postID string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, tiktokEmbedURL(postID), nil)
	if err != nil {
		return "", err
	}
	applyTikTokHeaders(req, "https://www.tiktok.com/")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	return embedHTMLOrError(string(body), resp.StatusCode)
}

func embedHTMLOrError(html string, status int) (string, error) {
	if status >= 400 || strings.Contains(html, "overload-protect") || strings.Contains(html, "Site Maintenance") {
		return "", fmt.Errorf("embed http %d", status)
	}
	if !strings.Contains(html, "__FRONTITY_CONNECT_STATE__") {
		return "", fmt.Errorf("embed html missing frontity state")
	}
	return html, nil
}

func parseTikTokEmbedMedia(html string) (playURL, videoURL string) {
	m := frontityStatePattern.FindStringSubmatch(html)
	if m == nil {
		return "", ""
	}
	var payload any
	if err := json.Unmarshal([]byte(m[1]), &payload); err != nil {
		return "", ""
	}
	return collectTikTokMedia(payload)
}

func collectTikTokMedia(node any) (playURL, videoURL string) {
	var walk func(any)
	walk = func(v any) {
		if playURL != "" && videoURL != "" {
			return
		}
		switch t := v.(type) {
		case []any:
			for _, child := range t {
				walk(child)
				if playURL != "" && videoURL != "" {
					return
				}
			}
		case map[string]any:
			if playURL == "" {
				playURL = firstURLString(t["playUrl"])
			}
			if videoURL == "" {
				videoURL = firstURLString(t["urls"])
			}
			if mi, ok := t["musicInfos"].(map[string]any); ok && playURL == "" {
				playURL = firstURLString(mi["playUrl"])
			}
			if item, ok := t["itemInfos"].(map[string]any); ok && videoURL == "" {
				if video, ok := item["video"].(map[string]any); ok {
					videoURL = firstURLString(video["urls"])
				}
			}
			for _, child := range t {
				walk(child)
				if playURL != "" && videoURL != "" {
					return
				}
			}
		}
	}
	walk(node)
	return playURL, videoURL
}

func firstURLString(v any) string {
	switch t := v.(type) {
	case string:
		if strings.HasPrefix(t, "http") {
			return t
		}
	case []any:
		for _, item := range t {
			if s, ok := item.(string); ok && strings.HasPrefix(s, "http") {
				return s
			}
		}
	}
	return ""
}

func downloadTikTokMedia(client *http.Client, tmpDir, mediaURL, baseName, cookieFile string) (string, error) {
	if curlAvailable() {
		binPath := filepath.Join(tmpDir, baseName+".bin")
		if err := curlDownloadFile(mediaURL, binPath, cookieFile, "https://www.tiktok.com/"); err != nil {
			log.Printf("[music-extract] tiktok curl media download failed: %v", err)
		} else {
			return finalizeDownloadedMedia(binPath, tmpDir, baseName, mediaURL)
		}
	}
	req, err := http.NewRequest(http.MethodGet, mediaURL, nil)
	if err != nil {
		return "", err
	}
	applyTikTokHeaders(req, "https://www.tiktok.com/")
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("media http %d", resp.StatusCode)
	}
	buf, err := io.ReadAll(io.LimitReader(resp.Body, maxMusicBytes+1))
	if err != nil {
		return "", err
	}
	if len(buf) == 0 {
		return "", fmt.Errorf("empty media response")
	}
	if len(buf) > maxMusicBytes {
		return "", fmt.Errorf("File nhạc quá lớn (tối đa 15MB)")
	}
	ext, _ := sniffAudioExt(buf, resp.Header.Get("Content-Type"), mediaURL)
	path := filepath.Join(tmpDir, baseName+ext)
	if err := os.WriteFile(path, buf, 0600); err != nil {
		return "", err
	}
	return path, nil
}

func finalizeDownloadedMedia(binPath, tmpDir, baseName, mediaURL string) (string, error) {
	buf, err := os.ReadFile(binPath)
	if err != nil {
		return "", err
	}
	if len(buf) == 0 {
		return "", fmt.Errorf("empty media response")
	}
	if len(buf) > maxMusicBytes {
		return "", fmt.Errorf("File nhạc quá lớn (tối đa 15MB)")
	}
	ext, _ := sniffAudioExt(buf, "", mediaURL)
	path := filepath.Join(tmpDir, baseName+ext)
	if err := os.Rename(binPath, path); err != nil {
		return "", err
	}
	return path, nil
}

func downloadTikTokVideoAudio(client *http.Client, tmpDir, videoURL, cookieFile string) (string, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return "", fmt.Errorf("ffmpeg not available")
	}
	videoPath, err := downloadTikTokMedia(client, tmpDir, videoURL, "tiktok-video", cookieFile)
	if err != nil {
		return "", err
	}
	outPath := filepath.Join(tmpDir, "music.mp3")
	cmd := exec.Command("ffmpeg", "-y", "-i", videoPath, "-vn", "-acodec", "libmp3lame", "-q:a", "4", outPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("ffmpeg: %s", strings.TrimSpace(string(out)))
	}
	return outPath, nil
}

func sniffAudioExt(buf []byte, contentType, srcURL string) (ext, mime string) {
	ct := strings.ToLower(contentType + " " + srcURL)
	switch {
	case strings.Contains(ct, "audio_mpeg") || strings.Contains(ct, "audio/mpeg") || strings.Contains(ct, "audio/mp3"):
		return ".mp3", "audio/mpeg"
	case strings.Contains(ct, "audio_mp4") || strings.Contains(ct, "audio/mp4") || strings.Contains(ct, "m4a"):
		return ".m4a", "audio/mp4"
	case strings.Contains(ct, "video/mp4") || strings.Contains(ct, "video_mp4"):
		return ".mp4", "video/mp4"
	}
	if len(buf) >= 3 && string(buf[:3]) == "ID3" {
		return ".mp3", "audio/mpeg"
	}
	if len(buf) >= 8 && string(buf[4:8]) == "ftyp" {
		return ".m4a", "audio/mp4"
	}
	return ".mp3", "audio/mpeg"
}

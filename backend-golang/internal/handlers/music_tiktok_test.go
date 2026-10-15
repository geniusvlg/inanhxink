package handlers

import (
	"os"
	"testing"
)

func TestTikTokPostID(t *testing.T) {
	cases := map[string]string{
		"https://www.tiktok.com/@nhactinhsaulang68/video/7377599319744056584?is_from_webapp=1&sender_device=pc": "7377599319744056584",
		"https://www.tiktok.com/@user/photo/1234567890123456789":                                                "1234567890123456789",
		"https://www.tiktok.com/embed/v2/7377599319744056584":                                                   "7377599319744056584",
		"https://www.tiktok.com/embed/7377599319744056584":                                                      "7377599319744056584",
		"https://youtube.com/watch?v=abc":                                                                       "",
	}
	for raw, want := range cases {
		if got := tiktokPostID(raw); got != want {
			t.Errorf("tiktokPostID(%q)=%q want %q", raw, got, want)
		}
	}
}

func TestTikTokEmbedURL(t *testing.T) {
	got := tiktokEmbedURL("7377599319744056584")
	want := "https://www.tiktok.com/embed/v2/7377599319744056584"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestRewriteTikTokPhotoURL(t *testing.T) {
	in := "https://www.tiktok.com/@thinkpad.x270.lover/photo/7594147928399219990?_r=1"
	got := rewriteTikTokPhotoURL(in)
	want := "https://www.tiktok.com/@thinkpad.x270.lover/video/7594147928399219990"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	video := "https://www.tiktok.com/@u/video/1"
	if rewriteTikTokPhotoURL(video) != video {
		t.Fatal("video urls should be unchanged")
	}
}

func TestParseTikTokEmbedMedia(t *testing.T) {
	html := `<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">{"source":{"data":{"/embed/v2/7377599319744056584":{"videoData":{"itemInfos":{"id":"7377599319744056584","video":{"urls":["https://example.com/video.mp4"],"videoMeta":{"duration":59}}},"musicInfos":{"musicName":"nhạc nền","playUrl":["https://v16m.tiktokcdn.com/audio.mp3?mime_type=audio_mpeg"]}}}}}}</script></html>`
	play, video := parseTikTokEmbedMedia(html)
	if play != "https://v16m.tiktokcdn.com/audio.mp3?mime_type=audio_mpeg" {
		t.Fatalf("playUrl=%q", play)
	}
	if video != "https://example.com/video.mp4" {
		t.Fatalf("videoURL=%q", video)
	}
}

func TestParseTikTokEmbedMediaMissing(t *testing.T) {
	play, video := parseTikTokEmbedMedia(`<html><body>overload-protect triggered</body></html>`)
	if play != "" || video != "" {
		t.Fatalf("expected empty, got %q %q", play, video)
	}
}

func TestImpersonateUnsupported(t *testing.T) {
	if !impersonateUnsupported([]byte("yt-dlp: error: no such option: --impersonate")) {
		t.Fatal("expected unsupported")
	}
	if impersonateUnsupported([]byte("ERROR: Unexpected response from webpage request")) {
		t.Fatal("anti-bot is not impersonate-unsupported")
	}
}

func TestParseTikTokPlayerVideoURLs(t *testing.T) {
	body := []byte(`{"items":[{"video_info":{"url_list":["https://cdn.example/default.mp4"],"profiles":[{"play_addr":{"url_list":["https://cdn.example/large.mp4"]}},{"play_addr":{"url_list":["https://cdn.example/small.mp4","https://cdn.example/small.mp4"]}}]}}]}`)
	got := parseTikTokPlayerVideoURLs(body)
	want := []string{"https://cdn.example/small.mp4", "https://cdn.example/large.mp4", "https://cdn.example/default.mp4"}
	if len(got) != len(want) {
		t.Fatalf("urls = %#v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("urls = %#v", got)
		}
	}
	if parseTikTokPlayerVideoURLs([]byte(`{"items":[]}`)) != nil {
		t.Fatal("empty items should have no urls")
	}
}

func TestParseTikLiveMusicURL(t *testing.T) {
	got, err := parseTikLiveMusicURL([]byte(`{"music":"https://v16-ies-music.tiktokcdn-us.com/track.mp3"}`))
	if err != nil {
		t.Fatal(err)
	}
	if got != "https://v16-ies-music.tiktokcdn-us.com/track.mp3" {
		t.Fatalf("music=%q", got)
	}
	if _, err := parseTikLiveMusicURL([]byte(`{"message":"Please sign up to tikliveapi.com"}`)); err == nil {
		t.Fatal("expected an error when music is missing")
	}
	if _, err := parseTikLiveMusicURL([]byte(`not-json`)); err == nil {
		t.Fatal("expected an error for invalid json")
	}
}

func TestDownloadTikTokViaTikLiveLive(t *testing.T) {
	if os.Getenv("LIVE_TIKTOK") == "" || tikliveAPIKey() == "" {
		t.Skip("set LIVE_TIKTOK=1 and TIKLIVE_API_KEY to hit TikLiveAPI")
	}
	path, err := downloadTikTokViaTikLive(t.TempDir(), "https://www.tiktok.com/@nhactinhsaulang68/video/7377599319744056584")
	if err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if st.Size() < 1000 {
		t.Fatalf("audio too small: %d bytes", st.Size())
	}
}

func TestDownloadTikTokViaPlayerLive(t *testing.T) {
	if os.Getenv("LIVE_TIKTOK") == "" {
		t.Skip("set LIVE_TIKTOK=1 to hit TikTok")
	}
	path, err := downloadTikTokViaPlayer(t.TempDir(), "7377599319744056584")
	if err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if st.Size() < 1000 {
		t.Fatalf("audio too small: %d bytes", st.Size())
	}
}

func TestDownloadTikTokViaEmbedLive(t *testing.T) {
	if os.Getenv("LIVE_TIKTOK") == "" {
		t.Skip("set LIVE_TIKTOK=1 to hit TikTok")
	}
	path, err := downloadTikTokViaEmbed(t.TempDir(),
		"https://www.tiktok.com/@nhactinhsaulang68/video/7377599319744056584",
		"7377599319744056584")
	if err != nil {
		t.Fatal(err)
	}
	st, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if st.Size() < 1000 {
		t.Fatalf("audio too small: %d bytes", st.Size())
	}
}

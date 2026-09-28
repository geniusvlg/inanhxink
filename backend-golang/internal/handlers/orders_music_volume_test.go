package handlers

import "testing"

func TestResolveMusicVolume(t *testing.T) {
	tests := []struct {
		name       string
		hasVoice   bool
		raw        any
		mixDefault float64
		wantVolume float64
	}{
		{name: "music only defaults to full volume", wantVolume: 1},
		{name: "music and voice default to four percent", hasVoice: true, wantVolume: 0.04},
		{name: "configured mix default is used when volume is omitted", hasVoice: true, mixDefault: 0.1, wantVolume: 0.1},
		{name: "explicit volume overrides mixed default", hasVoice: true, raw: 0.1, wantVolume: 0.1},
		{name: "explicit zero is preserved", hasVoice: true, raw: 0.0, wantVolume: 0},
		{name: "negative volume is clamped", raw: -0.5, wantVolume: 0},
		{name: "volume above one is clamped", raw: 1.5, wantVolume: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mixDefault := tt.mixDefault
			if mixDefault == 0 {
				mixDefault = 0.04
			}
			if got := resolveMusicVolume(tt.hasVoice, tt.raw, mixDefault); got != tt.wantVolume {
				t.Fatalf("resolveMusicVolume(%v, %v, %v) = %v, want %v", tt.hasVoice, tt.raw, mixDefault, got, tt.wantVolume)
			}
		})
	}
}

func TestParseDefaultMusicVolume(t *testing.T) {
	if got := parseDefaultMusicVolume(""); got != 0.04 {
		t.Fatalf("empty = %v", got)
	}
	if got := parseDefaultMusicVolume("10"); got != 0.1 {
		t.Fatalf("10 = %v", got)
	}
	if got := parseDefaultMusicVolume("0"); got != 0 {
		t.Fatalf("0 = %v", got)
	}
	if got := parseDefaultMusicVolume("101"); got != 0.04 {
		t.Fatalf("101 = %v", got)
	}
}

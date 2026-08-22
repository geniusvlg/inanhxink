package handlers

import "testing"

func TestResolveMusicVolume(t *testing.T) {
	tests := []struct {
		name       string
		hasVoice   bool
		raw        any
		wantVolume float64
	}{
		{name: "music only defaults to full volume", wantVolume: 1},
		{name: "music and voice default to four percent", hasVoice: true, wantVolume: 0.04},
		{name: "explicit volume overrides mixed default", hasVoice: true, raw: 0.1, wantVolume: 0.1},
		{name: "explicit zero is preserved", hasVoice: true, raw: 0.0, wantVolume: 0},
		{name: "negative volume is clamped", raw: -0.5, wantVolume: 0},
		{name: "volume above one is clamped", raw: 1.5, wantVolume: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := resolveMusicVolume(tt.hasVoice, tt.raw); got != tt.wantVolume {
				t.Fatalf("resolveMusicVolume(%v, %v) = %v, want %v", tt.hasVoice, tt.raw, got, tt.wantVolume)
			}
		})
	}
}

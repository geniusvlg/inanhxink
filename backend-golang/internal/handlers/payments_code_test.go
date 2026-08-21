package handlers

import "testing"

func TestQRPaymentCode(t *testing.T) {
	got := qrPaymentCode(196, "122611")
	if got != "INXK196Q122611" {
		t.Fatalf("qrPaymentCode = %q, want INXK196Q122611", got)
	}
	if qrPaymentCode(42, "anhyeuem") != "INXK42Qanhyeuem" {
		t.Fatalf("letter name: %q", qrPaymentCode(42, "anhyeuem"))
	}
}

func TestParseQRPaymentOrderID(t *testing.T) {
	cases := []struct {
		content string
		want    int
		ok      bool
	}{
		{"INXK196Q122611", 196, true},
		{"FT123 INXK196Q122611 nguoi chuyen", 196, true},
		{"inxk196q122611", 196, true},
		{"INXK 196 Q 122611", 196, true},
		{"INXK42anhyeuem", 42, true},
		{"INXK42-hello", 42, true},
		{"INXK42_hello", 42, true},
		{"INXK196122611", 0, false}, // all-digit name, no separator
		{"nope", 0, false},
		{"INXK0Qfoo", 0, false},
	}
	for _, tc := range cases {
		got, ok := parseQRPaymentOrderID(tc.content)
		if ok != tc.ok || got != tc.want {
			t.Errorf("parseQRPaymentOrderID(%q) = (%d, %v), want (%d, %v)",
				tc.content, got, ok, tc.want, tc.ok)
		}
	}
}

func TestPaymentCodeFromQRURL(t *testing.T) {
	url := "https://qr.sepay.vn/img?acc=1&bank=MB&amount=1000&des=INXK196122611&template=compact"
	if got := paymentCodeFromQRURL(url, "fallback"); got != "INXK196122611" {
		t.Fatalf("got %q", got)
	}
	if got := paymentCodeFromQRURL("not-a-url", "fallback"); got != "fallback" {
		t.Fatalf("fallback got %q", got)
	}
}

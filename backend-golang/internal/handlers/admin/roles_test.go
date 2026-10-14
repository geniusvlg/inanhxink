package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDecodeRoleBody(t *testing.T) {
	body := `{"name":"  Manager  ","description":"  xem thiệp  ","permissions":["thiep.view","thiep.view","banners.create"]}`
	rec := httptest.NewRecorder()
	got, ok := decodeRoleBody(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
	if !ok {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
	if got.Name != "Manager" || got.Description != "xem thiệp" {
		t.Fatalf("name=%q description=%q", got.Name, got.Description)
	}
	if len(got.Permissions) != 2 || got.Permissions[0] != "thiep.view" || got.Permissions[1] != "banners.create" {
		t.Fatalf("permissions = %#v", got.Permissions)
	}
}

func TestDecodeRoleBodyRejects(t *testing.T) {
	cases := []string{
		`{"name":"","permissions":[]}`,
		`{"name":"   ","permissions":[]}`,
		`{"name":"` + strings.Repeat("a", 101) + `","permissions":[]}`,
		`{"name":"Manager","description":"` + strings.Repeat("a", 501) + `","permissions":[]}`,
		`{"name":"Manager","permissions":["users.view"]}`,
		`not json`,
	}
	for _, body := range cases {
		rec := httptest.NewRecorder()
		if _, ok := decodeRoleBody(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))); ok || rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: ok=%v status=%d", body, ok, rec.Code)
		}
	}
}

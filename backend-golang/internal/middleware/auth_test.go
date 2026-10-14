package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"inanhxink/backend-golang/internal/authz"
)

func TestPrincipalCan(t *testing.T) {
	staff := &Principal{Permissions: map[string]struct{}{"thiep.view": {}}}
	if !staff.Can("thiep.view") {
		t.Fatal("assigned key was denied")
	}
	if staff.Can("thiep.create") {
		t.Fatal("missing key was allowed")
	}

	admin := &Principal{IsSystem: true}
	for _, key := range authz.AllKeys() {
		if !admin.Can(key) {
			t.Fatalf("system admin denied %s", key)
		}
	}
	if admin.Can("users.view") {
		t.Fatal("system admin was granted a key outside the catalog")
	}
	if (*Principal)(nil).Can("thiep.view") {
		t.Fatal("nil principal was allowed")
	}
}

func TestPrincipalHasWrite(t *testing.T) {
	cases := []struct {
		name string
		p    *Principal
		want bool
	}{
		{"nil", nil, false},
		{"view only", &Principal{Permissions: map[string]struct{}{"thiep.view": {}}}, false},
		{"delete only", &Principal{Permissions: map[string]struct{}{"thiep.delete": {}}}, false},
		{"create", &Principal{Permissions: map[string]struct{}{"thiep.create": {}}}, true},
		{"update", &Principal{Permissions: map[string]struct{}{"banners.update": {}}}, true},
		{"system", &Principal{IsSystem: true}, true},
	}
	for _, tc := range cases {
		if got := tc.p.HasWrite(); got != tc.want {
			t.Errorf("%s: HasWrite() = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestRequirePermission(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	h := RequirePermission("thiep.view", "thiep.create")

	allowed := WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), &Principal{
		Permissions: map[string]struct{}{"thiep.create": {}},
	})
	rec := httptest.NewRecorder()
	h(next).ServeHTTP(rec, allowed)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("matching permission: status %d", rec.Code)
	}

	admin := WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), &Principal{IsSystem: true})
	rec = httptest.NewRecorder()
	h(next).ServeHTTP(rec, admin)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("system admin: status %d", rec.Code)
	}

	denied := WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), &Principal{
		Permissions: map[string]struct{}{"thiep.delete": {}},
	})
	rec = httptest.NewRecorder()
	h(next).ServeHTTP(rec, denied)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("missing permission: status %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	h(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("no principal: status %d", rec.Code)
	}
}

func TestRequireSystemAdmin(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	h := RequireSystemAdmin(next)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), &Principal{IsSystem: true}))
	if rec.Code != http.StatusNoContent {
		t.Fatalf("system admin: status %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), &Principal{
		Permissions: map[string]struct{}{"thiep.view": {}, "thiep.create": {}, "thiep.update": {}, "thiep.delete": {}},
	}))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("custom role: status %d", rec.Code)
	}
}

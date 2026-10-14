package admin

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"inanhxink/backend-golang/internal/middleware"
)

func requestAs(p *middleware.Principal) *http.Request {
	return middleware.WithAdmin(httptest.NewRequest(http.MethodGet, "/", nil), p)
}

func TestAllowProductAction(t *testing.T) {
	staff := &middleware.Principal{Permissions: map[string]struct{}{"thiep.update": {}}}
	rec := httptest.NewRecorder()
	if !allowProductAction(rec, requestAs(staff), "thiep", "update") {
		t.Fatal("thiep.update was denied")
	}

	rec = httptest.NewRecorder()
	if allowProductAction(rec, requestAs(staff), "khung_anh", "update") || rec.Code != http.StatusForbidden {
		t.Fatalf("other type: status %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	if allowProductAction(rec, requestAs(staff), "nope", "view") || rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown type: status %d", rec.Code)
	}

	admin := &middleware.Principal{IsSystem: true}
	rec = httptest.NewRecorder()
	if !allowProductAction(rec, requestAs(admin), "set-qua-tang", "delete") {
		t.Fatal("system admin was denied set-qua-tang.delete")
	}
}

func TestAllowProductList(t *testing.T) {
	reviews := &middleware.Principal{Permissions: map[string]struct{}{"product_reviews.view": {}}}
	rec := httptest.NewRecorder()
	if !allowProductList(rec, requestAs(reviews), "khung_anh") {
		t.Fatal("reviews permission could not list a product type")
	}

	thiep := &middleware.Principal{Permissions: map[string]struct{}{"thiep.view": {}}}
	rec = httptest.NewRecorder()
	if allowProductList(rec, requestAs(thiep), "in_anh") || rec.Code != http.StatusForbidden {
		t.Fatalf("unrelated type: status %d", rec.Code)
	}
}

func TestViewableProductTypes(t *testing.T) {
	one := viewableProductTypes(requestAs(&middleware.Principal{
		Permissions: map[string]struct{}{"thiep.view": {}, "set_qua_tang.view": {}},
	}))
	if !sameTypes(one, []string{"thiep", "set-qua-tang"}) {
		t.Fatalf("limited types = %v", one)
	}

	all := viewableProductTypes(requestAs(&middleware.Principal{
		Permissions: map[string]struct{}{"product_reviews.view": {}},
	}))
	if !sameTypes(all, []string{"thiep", "khung_anh", "so_scrapbook", "khac", "set-qua-tang", "in_anh"}) {
		t.Fatalf("reviews types = %v", all)
	}
}

func sameTypes(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := map[string]int{}
	for _, item := range got {
		seen[item]++
	}
	for _, item := range want {
		seen[item]--
		if seen[item] < 0 {
			return false
		}
	}
	return true
}

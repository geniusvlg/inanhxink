package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestUpdateProfileRejectsLongName(t *testing.T) {
	body := `{"display_name":"` + strings.Repeat("a", 101) + `"}`
	rec := httptest.NewRecorder()
	UpdateProfile(rec, httptest.NewRequest(http.MethodPut, "/", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d body %s", rec.Code, rec.Body.String())
	}
}

func TestChangePasswordRejectsBeforeLookup(t *testing.T) {
	cases := []string{
		`{}`,
		`{"current_password":"secret","new_password":"short"}`,
		`{"current_password":"secret","new_password":"` + strings.Repeat("a", 101) + `"}`,
		`{"current_password":"samepass","new_password":"samepass"}`,
		`not json`,
	}
	for _, body := range cases {
		rec := httptest.NewRecorder()
		ChangePassword(rec, httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body)))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("body %q: status %d", body, rec.Code)
		}
	}
}

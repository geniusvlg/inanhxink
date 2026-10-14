package admin

import "testing"

func TestUsernamePattern(t *testing.T) {
	ok := []string{"tam", "admin", "a.b_c-1", "abc"}
	for _, name := range ok {
		if !usernamePattern.MatchString(name) {
			t.Errorf("rejected %q", name)
		}
	}
	bad := []string{"tâm", "ab", "has space", "a@b", "", "Tâm"}
	for _, name := range bad {
		if usernamePattern.MatchString(name) {
			t.Errorf("accepted %q", name)
		}
	}
	long := make([]byte, 100)
	for i := range long {
		long[i] = 'a'
	}
	if !usernamePattern.MatchString(string(long)) {
		t.Fatal("100 characters was rejected")
	}
	if usernamePattern.MatchString(string(long) + "a") {
		t.Fatal("101 characters was accepted")
	}
}

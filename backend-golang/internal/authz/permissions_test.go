package authz

import "testing"

func TestKnownAndAllKeys(t *testing.T) {
	keys := AllKeys()
	seen := map[string]struct{}{}
	for _, key := range keys {
		if !Known(key) {
			t.Errorf("AllKeys returned unknown key %q", key)
		}
		if _, ok := seen[key]; ok {
			t.Errorf("duplicate key %q", key)
		}
		seen[key] = struct{}{}
	}
	for _, area := range Catalog {
		for _, action := range area.Actions {
			key := area.Key + "." + action
			if _, ok := seen[key]; !ok {
				t.Errorf("AllKeys missing %s", key)
			}
		}
	}
	for _, key := range []string{
		"featured.create",
		"featured.delete",
		"product_reviews.update",
		"users.view",
		"roles.update",
		"",
	} {
		if Known(key) {
			t.Errorf("Known(%q) = true", key)
		}
	}
}

func TestAreaForProductType(t *testing.T) {
	area, ok := AreaForProductType("set-qua-tang")
	if !ok || area != "set_qua_tang" {
		t.Fatalf("set-qua-tang -> (%q, %v)", area, ok)
	}
	for _, productType := range []string{"thiep", "khung_anh", "so_scrapbook", "khac", "in_anh"} {
		area, ok := AreaForProductType(productType)
		if !ok || area != productType {
			t.Errorf("%s -> (%q, %v)", productType, area, ok)
		}
	}
	if _, ok := AreaForProductType("nope"); ok {
		t.Fatal("unknown type was accepted")
	}
}

func TestProductTypesForAreas(t *testing.T) {
	got := ProductTypesForAreas(map[string]struct{}{
		"thiep":        {},
		"set_qua_tang": {},
	})
	want := map[string]struct{}{"thiep": {}, "set-qua-tang": {}}
	if len(got) != len(want) {
		t.Fatalf("types = %v", got)
	}
	for _, productType := range got {
		if _, ok := want[productType]; !ok {
			t.Errorf("unexpected type %q", productType)
		}
	}
}

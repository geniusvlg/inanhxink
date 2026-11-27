package handlers

import (
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestAsFloatReadsPostgresNumeric(t *testing.T) {
	var amount pgtype.Numeric
	if err := amount.Scan("10000.00"); err != nil {
		t.Fatal(err)
	}
	if got := asFloat(amount); got != 10000 {
		t.Fatalf("asFloat(numeric) = %v, want 10000", got)
	}
	if got := MapFloat64(map[string]any{"discount_value": amount}, "discount_value"); got != 10000 {
		t.Fatalf("MapFloat64(numeric) = %v, want 10000", got)
	}
}

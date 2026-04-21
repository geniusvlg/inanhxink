package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"inanhxink/backend-golang/internal/config"
)

// POST /api/vouchers/validate
func ValidateVoucher(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Code == "" {
		BadRequest(w, "Voucher code is required")
		return
	}

	rows, err := config.DB.Query(context.Background(), `
		SELECT code, discount_type, discount_value FROM vouchers
		WHERE UPPER(code) = UPPER($1) AND is_active = true
		AND (expires_at IS NULL OR expires_at > NOW())
		AND (max_uses IS NULL OR used_count < max_uses)`,
		body.Code)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Invalid or expired voucher code"})
		return
	}

	var discountVal float64
	switch v := row["discount_value"].(type) {
	case float64:
		discountVal = v
	case string:
		json.Unmarshal([]byte(v), &discountVal) //nolint
	}

	OK(w, map[string]any{
		"success": true,
		"voucher": map[string]any{
			"code":          row["code"],
			"discountType":  row["discount_type"],
			"discountValue": discountVal,
		},
	})
}

package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/vouchers
func ListVouchers(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM vouchers ORDER BY created_at DESC")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	vouchers, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "vouchers": vouchers})
}

// POST /api/admin/vouchers
func CreateVoucher(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	code, _ := body["code"].(string)
	discountType, _ := body["discount_type"].(string)
	discountValue := body["discount_value"]
	if code == "" || discountType == "" || discountValue == nil {
		handlers.BadRequest(w, "code, discount_type and discount_value are required")
		return
	}
	isActive := true
	if v, ok := body["is_active"].(bool); ok {
		isActive = v
	}

	rows, err := config.DB.Query(context.Background(), `
		INSERT INTO vouchers (code, discount_type, discount_value, max_uses, expires_at, is_active)
		VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
		strings.ToUpper(code), discountType, discountValue, body["max_uses"], body["expires_at"], isActive)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.OK(w, map[string]any{"success": true, "voucher": row})
}

// PUT /api/admin/vouchers/:id
func UpdateVoucher(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	rows, err := config.DB.Query(context.Background(), `
		UPDATE vouchers SET discount_type = $1, discount_value = $2, max_uses = $3,
			expires_at = $4, is_active = $5
		WHERE id = $6 RETURNING *`,
		body["discount_type"], body["discount_value"], body["max_uses"],
		body["expires_at"], body["is_active"], id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "voucher": row})
}

// DELETE /api/admin/vouchers/:id
func DeleteVoucher(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := config.DB.Exec(context.Background(),
		"DELETE FROM vouchers WHERE id = $1", id); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

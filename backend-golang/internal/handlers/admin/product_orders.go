package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/product-orders?page=&limit=&payment_status=
func ListProductOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := handlers.Clamp(handlers.IntParam(q.Get("page"), 1), 1, 1<<30)
	limit := handlers.Clamp(handlers.IntParam(q.Get("limit"), 20), 1, 100)
	offset := (page - 1) * limit

	conditions := []string{}
	params := []any{}
	idx := 1
	if v := q.Get("payment_status"); v != "" {
		conditions = append(conditions, fmt.Sprintf("payment_status = $%d", idx))
		params = append(params, v)
		idx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + conditions[0]
	}

	filterParams := make([]any, len(params))
	copy(filterParams, params)

	params = append(params, limit, offset)
	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf(`SELECT * FROM product_orders %s
			ORDER BY created_at DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1),
		params...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	orders, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}

	countRow := config.DB.QueryRow(context.Background(),
		fmt.Sprintf("SELECT COUNT(*) FROM product_orders %s", where), filterParams...)
	var total int
	countRow.Scan(&total) //nolint

	handlers.OK(w, map[string]any{
		"success":        true,
		"product_orders": orders,
		"total":          total,
		"page":           page,
		"limit":          limit,
	})
}

// GET /api/admin/product-orders/:id
func GetProductOrder(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM product_orders WHERE id = $1", chi.URLParam(r, "id"))
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "product_order": row})
}

// PATCH /api/admin/product-orders/:id/status
func UpdateProductOrderStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		PaymentStatus string `json:"payment_status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if body.PaymentStatus == "" {
		handlers.BadRequest(w, "payment_status is required")
		return
	}

	rows, err := config.DB.Query(context.Background(), `
		UPDATE product_orders SET payment_status = $1, updated_at = NOW()
		WHERE id = $2 RETURNING *`, body.PaymentStatus, id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	order, err := handlers.CollectOne(rows)
	if err != nil || order == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "product_order": order})
}

// GET /api/admin/product-orders/fulfillment?fulfillment_status=
// Returns all PAID product orders AND paid QR orders with keychain, filtered by fulfillment stage.
// fulfillment_status="" (omitted) means "new" = not yet started.
func ListFulfillmentOrders(w http.ResponseWriter, r *http.Request) {
	stage := r.URL.Query().Get("fulfillment_status")
	if stage == "" {
		stage = "new"
	}

	// product_orders: fulfillment_status IS NULL → 'new', otherwise use the value.
	// orders (keychain): keychain_delivery_status 'processing' → 'new', otherwise use value.
	query := `
		SELECT order_type, id, reference, customer_name, customer_phone,
		       customer_address, items_json, total_amount, fulfillment_stage, tracking_code, created_at
		FROM (
			SELECT
				'product'                                          AS order_type,
				id,
				COALESCE(invoice_number, '')                       AS reference,
				customer_name,
				COALESCE(customer_phone, '')                       AS customer_phone,
				COALESCE(customer_address, '')                     AS customer_address,
				items::text                                        AS items_json,
				total_amount,
				COALESCE(fulfillment_status, 'new')                AS fulfillment_stage,
				COALESCE(tracking_code, '')                        AS tracking_code,
				created_at
			FROM product_orders
			WHERE payment_status = 'paid'

			UNION ALL

			SELECT
				'qr_keychain'                                      AS order_type,
				id,
				qr_name                                            AS reference,
				COALESCE(customer_name, qr_name)                   AS customer_name,
				COALESCE(customer_phone, '')                       AS customer_phone,
				''                                                 AS customer_address,
				('[{"product_name":"Móc khóa QR","quantity":1,"unit_price":'
					|| keychain_price || '}]')                     AS items_json,
				keychain_price                                     AS total_amount,
				CASE keychain_delivery_status
					WHEN 'processing' THEN 'new'
					ELSE COALESCE(keychain_delivery_status, 'new')
				END                                                AS fulfillment_stage,
				COALESCE(tracking_code, '')                        AS tracking_code,
				created_at
			FROM orders
			WHERE payment_status = 'paid' AND keychain_purchased = true
		) sub
		WHERE fulfillment_stage = $1
		ORDER BY created_at ASC`

	rows, err := config.DB.Query(context.Background(), query, stage)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	orders, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "orders": orders})
}

// PATCH /api/admin/product-orders/:id/fulfillment
func UpdateFulfillmentStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		FulfillmentStatus string `json:"fulfillment_status"`
		TrackingCode      string `json:"tracking_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	allowed := map[string]bool{"preparing": true, "packing": true, "shipped": true}
	if !allowed[body.FulfillmentStatus] {
		handlers.BadRequest(w, "fulfillment_status must be preparing, packing, or shipped")
		return
	}

	// Always write tracking_code; it will only be non-empty for "shipped".
	rows, err := config.DB.Query(context.Background(), `
		UPDATE product_orders
		SET fulfillment_status = $1::varchar,
		    tracking_code      = CASE WHEN $1::varchar = 'shipped' THEN $2 ELSE tracking_code END,
		    updated_at         = NOW()
		WHERE id = $3 AND payment_status = 'paid'
		RETURNING *`,
		body.FulfillmentStatus, body.TrackingCode, id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	order, err := handlers.CollectOne(rows)
	if err != nil || order == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "product_order": order})
}

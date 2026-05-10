package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	"inanhxink/backend-golang/internal/notify"
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

	ctx := context.Background()
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	var prevPayment string
	var itemsJSON string
	if err := tx.QueryRow(ctx,
		`SELECT payment_status, items::text FROM product_orders WHERE id = $1 FOR UPDATE`,
		id).Scan(&prevPayment, &itemsJSON); err != nil {
		handlers.NotFound(w)
		return
	}

	rows, err := tx.Query(ctx, `
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

	if body.PaymentStatus == "paid" && prevPayment != "paid" {
		var items []handlers.OrderItem
		if err := json.Unmarshal([]byte(itemsJSON), &items); err != nil {
			handlers.InternalError(w, err)
			return
		}
		if err := handlers.IncrementProductSoldCounts(ctx, tx, items); err != nil {
			handlers.InternalError(w, err)
			return
		}
	}

	if err := tx.Commit(ctx); err != nil {
		handlers.InternalError(w, err)
		return
	}

	// When admin manually marks an order as paid, move temp images to the paid
	// prefix — same as the payment webhook does.
	if body.PaymentStatus == "paid" {
		orderIDInt := handlers.IntParam(id, 0)
		if orderIDInt > 0 {
			go func() {
				var itemsJSON string
				if err := config.DB.QueryRow(context.Background(),
					"SELECT items::text FROM product_orders WHERE id = $1", orderIDInt).Scan(&itemsJSON); err != nil {
					return
				}
				var items []handlers.OrderItem
				if err := json.Unmarshal([]byte(itemsJSON), &items); err != nil {
					return
				}
				movedItems := handlers.MoveTempImages(items, orderIDInt)
				if movedJSON, err := json.Marshal(movedItems); err == nil {
					config.DB.Exec(context.Background(), //nolint
						"UPDATE product_orders SET items = $1 WHERE id = $2",
						string(movedJSON), orderIDInt)
				}
			}()
		}
	}

	if body.PaymentStatus == "paid" && prevPayment != "paid" {
		oid := handlers.MapInt(order, "id")
		if oid == 0 {
			oid = handlers.IntParam(id, 0)
		}
		var itemsLines string
		var items []handlers.OrderItem
		if err := json.Unmarshal([]byte(itemsJSON), &items); err == nil {
			itemsLines = handlers.FormatProductOrderItemsVN(items)
		}
		notify.ProductOrderPaid(notify.ProductOrderPaidDetail{
			OrderID:         oid,
			InvoiceNumber:   handlers.MapStr(order, "invoice_number"),
			CustomerName:    handlers.MapStr(order, "customer_name"),
			CustomerPhone:   handlers.MapStr(order, "customer_phone"),
			CustomerEmail:   handlers.MapStr(order, "customer_email"),
			CustomerAddress: handlers.MapStr(order, "customer_address"),
			Subtotal:        handlers.MapFloat64(order, "subtotal"),
			ShippingFee:     handlers.MapFloat64(order, "shipping_fee"),
			Total:           handlers.MapFloat64(order, "total_amount"),
			ItemsLines:      itemsLines,
		})
	}

	handlers.OK(w, map[string]any{"success": true, "product_order": order})
}

// GET /api/admin/product-orders/fulfillment?fulfillment_status=&limit=&offset=
// Returns all PAID product orders AND paid QR orders with keychain, filtered by fulfillment stage.
// fulfillment_status="" (omitted) means "new" = not yet started.
// limit/offset are applied only for the "shipped" stage (default limit 30).
func ListFulfillmentOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	stage := q.Get("fulfillment_status")
	if stage == "" {
		stage = "new"
	}

	limit := handlers.IntParam(q.Get("limit"), 30)
	offset := handlers.IntParam(q.Get("offset"), 0)
	if limit < 1 || limit > 200 {
		limit = 30
	}
	if offset < 0 {
		offset = 0
	}

	// product_orders: fulfillment_status IS NULL → 'new', otherwise use the value.
	// orders (keychain): keychain_delivery_status 'processing' → 'new', otherwise use value.
	query := `
		SELECT order_type, id, reference, customer_name, customer_phone,
		       customer_address, items_json, total_amount, fulfillment_stage, tracking_code, shipping_carrier, created_at
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
				COALESCE(shipping_carrier, '')                     AS shipping_carrier,
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
				COALESCE(shipping_carrier, '')                     AS shipping_carrier,
				created_at
			FROM orders
			WHERE payment_status = 'paid' AND keychain_purchased = true
		) sub
		WHERE fulfillment_stage = $1
		ORDER BY created_at ASC`

	if stage == "shipped" {
		// Fetch one extra row to detect whether more pages exist.
		shippedRows, err := config.DB.Query(context.Background(), query+" LIMIT $2 OFFSET $3", stage, limit+1, offset)
		if err != nil {
			handlers.InternalError(w, err)
			return
		}
		all, err := handlers.CollectRows(shippedRows)
		if err != nil {
			handlers.InternalError(w, err)
			return
		}
		hasMore := len(all) > limit
		if hasMore {
			all = all[:limit]
		}
		handlers.OK(w, map[string]any{"success": true, "orders": all, "has_more": hasMore, "offset": offset, "limit": limit})
		return
	}

	plainRows, err := config.DB.Query(context.Background(), query, stage)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	orders, err := handlers.CollectRows(plainRows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "orders": orders, "has_more": false})
}

// PATCH /api/admin/product-orders/:id/fulfillment
func UpdateFulfillmentStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		FulfillmentStatus string `json:"fulfillment_status"`
		TrackingCode      string `json:"tracking_code"`
		ShippingCarrier   string `json:"shipping_carrier"`
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
	if body.FulfillmentStatus == "shipped" && (strings.TrimSpace(body.TrackingCode) == "" || strings.TrimSpace(body.ShippingCarrier) == "") {
		handlers.BadRequest(w, "tracking_code and shipping_carrier are required when shipped")
		return
	}

	// Always write tracking_code; it will only be non-empty for "shipped".
	rows, err := config.DB.Query(context.Background(), `
		UPDATE product_orders
		SET fulfillment_status = $1::varchar,
		    tracking_code      = CASE WHEN $1::varchar = 'shipped' THEN $2 ELSE tracking_code END,
		    shipping_carrier   = CASE WHEN $1::varchar = 'shipped' THEN $3 ELSE shipping_carrier END,
		    updated_at         = NOW()
		WHERE id = $4 AND payment_status = 'paid'
		RETURNING *`,
		body.FulfillmentStatus, body.TrackingCode, body.ShippingCarrier, id)
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

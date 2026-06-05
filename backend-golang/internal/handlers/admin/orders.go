package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	"inanhxink/backend-golang/internal/notify"
)

func adminDomain() string {
	if d := os.Getenv("DOMAIN"); d != "" {
		return d
	}
	return "inanhxink.com"
}

// GET /api/admin/orders?page=&limit=&payment_status=&keychain_delivery_status=
func ListOrders(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := handlers.Clamp(handlers.IntParam(q.Get("page"), 1), 1, 1<<30)
	limit := handlers.Clamp(handlers.IntParam(q.Get("limit"), 20), 1, 100)
	offset := (page - 1) * limit

	conditions := []string{}
	params := []any{}
	idx := 1

	if v := q.Get("payment_status"); v != "" {
		conditions = append(conditions, fmt.Sprintf("o.payment_status = $%d", idx))
		params = append(params, v)
		idx++
	}
	if v := q.Get("keychain_delivery_status"); v != "" {
		conditions = append(conditions, fmt.Sprintf("o.keychain_delivery_status = $%d", idx))
		params = append(params, v)
		idx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + joinClauses(conditions)
	}

	filterParams := make([]any, len(params))
	copy(filterParams, params)

	params = append(params, limit, offset)
	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf(`SELECT o.*, t.name AS template_name FROM orders o
			LEFT JOIN templates t ON t.id = o.template_id
			%s ORDER BY o.created_at DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1),
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
		fmt.Sprintf("SELECT COUNT(*) FROM orders o %s", where), filterParams...)
	var total int
	countRow.Scan(&total) //nolint

	handlers.OK(w, map[string]any{"success": true, "orders": orders, "total": total, "page": page, "limit": limit})
}

// GET /api/admin/orders/:id
func GetOrder(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT o.*, t.name AS template_name, q.template_data
		FROM orders o
		LEFT JOIN templates t ON t.id = o.template_id
		LEFT JOIN qr_codes q ON q.qr_name = o.qr_name
		WHERE o.id = $1`, chi.URLParam(r, "id"))
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "order": row})
}

// PATCH /api/admin/orders/:id/status
func UpdateOrderStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		PaymentStatus          string `json:"payment_status"`
		KeychainDeliveryStatus string `json:"keychain_delivery_status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	setClauses := []string{}
	values := []any{}
	i := 1
	if body.PaymentStatus != "" {
		setClauses = append(setClauses, fmt.Sprintf("payment_status = $%d", i))
		values = append(values, body.PaymentStatus)
		i++
	}
	if body.KeychainDeliveryStatus != "" {
		setClauses = append(setClauses, fmt.Sprintf("keychain_delivery_status = $%d", i))
		values = append(values, body.KeychainDeliveryStatus)
		i++
	}
	if len(setClauses) == 0 {
		handlers.BadRequest(w, "payment_status or keychain_delivery_status is required")
		return
	}
	values = append(values, id)

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	var prevPayment string
	if err := tx.QueryRow(context.Background(),
		`SELECT payment_status FROM orders WHERE id = $1 FOR UPDATE`, id).Scan(&prevPayment); err != nil {
		handlers.NotFound(w)
		return
	}

	orderRows, err := tx.Query(context.Background(),
		fmt.Sprintf("UPDATE orders SET %s, updated_at = NOW() WHERE id = $%d RETURNING *",
			joinClauses(setClauses), len(values)),
		values...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	order, err := handlers.CollectOne(orderRows)
	if err != nil || order == nil {
		handlers.NotFound(w)
		return
	}

	// If admin manually marks payment as paid, activate the QR code
	if ps, ok := order["payment_status"].(string); ok && ps == "paid" {
		if qrName, ok := order["qr_name"].(string); ok && qrName != "" {
			fullUrl := qrName + "." + adminDomain()
			templateType, _ := order["template_type"].(string)
			if templateType == "" {
				templateType = "galaxy"
			}
			tdJSON := "{}"
			if td, ok := order["template_data"]; ok {
				if b, err := json.Marshal(td); err == nil {
					tdJSON = string(b)
				}
			}
			content, _ := order["content"].(string)
			templateID := order["template_id"]

			var qrID int
			tx.QueryRow(context.Background(), `
				INSERT INTO qr_codes (qr_name, full_url, content, template_id, template_type, template_data)
				VALUES ($1,$2,$3,$4,$5,$6)
				ON CONFLICT (qr_name) DO UPDATE
					SET full_url=EXCLUDED.full_url, content=EXCLUDED.content,
						template_id=EXCLUDED.template_id, template_type=EXCLUDED.template_type,
						template_data=EXCLUDED.template_data, updated_at=NOW()
				RETURNING id`,
				qrName, fullUrl, content, templateID, templateType, tdJSON,
			).Scan(&qrID) //nolint
			tx.Exec(context.Background(), "UPDATE orders SET qr_code_id = $1 WHERE id = $2", qrID, id) //nolint
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}

	if body.PaymentStatus == "paid" && prevPayment != "paid" {
		oid := handlers.MapInt(order, "id")
		if oid == 0 {
			oid = handlers.IntParam(id, 0)
		}
		notify.QROrderPaid(notify.QROrderPaidDetail{
			OrderID:       oid,
			QRName:        handlers.MapStr(order, "qr_name"),
			TemplateType:  handlers.MapStr(order, "template_type"),
			CustomerName:  handlers.MapStr(order, "customer_name"),
			CustomerEmail: handlers.MapStr(order, "customer_email"),
			CustomerPhone: handlers.MapStr(order, "customer_phone"),
			Total:         handlers.MapFloat64(order, "total_amount"),
			Domain:        adminDomain(),
		})
	}

	handlers.OK(w, map[string]any{"success": true, "order": order})
}

// GET /api/admin/orders/search?invoice=&name=&phone=
// Searches both product_orders and QR orders. At least one param required.
// Returns up to 20 matches per table across ALL fulfillment stages, newest first.
func SearchOrder(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	invoice := strings.TrimSpace(q.Get("invoice"))
	name := strings.TrimSpace(q.Get("name"))
	phone := strings.TrimSpace(q.Get("phone"))

	if invoice == "" && name == "" && phone == "" {
		handlers.BadRequest(w, "at least one of invoice, name, phone is required")
		return
	}

	fulfillmentLabel := func(stage string) string {
		switch stage {
		case "preparing":
			return "Đang chuẩn bị"
		case "packing":
			return "Đóng gói"
		case "shipped":
			return "Đã giao vận chuyển"
		default:
			return "Chờ xử lý"
		}
	}

	type result struct {
		Type  string         `json:"type"`
		Order map[string]any `json:"order"`
	}
	var results []result

	// Build dynamic WHERE for product_orders.
	pConds := []string{"payment_status = 'paid'"}
	pArgs := []any{}
	i := 1
	if invoice != "" {
		pConds = append(pConds, fmt.Sprintf("invoice_number ILIKE $%d", i))
		pArgs = append(pArgs, "%"+invoice+"%")
		i++
	}
	if name != "" {
		pConds = append(pConds, fmt.Sprintf("customer_name ILIKE $%d", i))
		pArgs = append(pArgs, "%"+name+"%")
		i++
	}
	if phone != "" {
		pConds = append(pConds, fmt.Sprintf("customer_phone ILIKE $%d", i))
		pArgs = append(pArgs, "%"+phone+"%")
		i++
	}
	productWhere := strings.Join(pConds, " AND ")

	productRows, err := config.DB.Query(context.Background(),
		fmt.Sprintf(`SELECT id, invoice_number, customer_name, customer_phone, customer_address,
		       items::text AS items, total_amount, payment_status,
		       COALESCE(fulfillment_status, 'new') as fulfillment_status,
		       COALESCE(tracking_code, '') as tracking_code,
		       COALESCE(shipping_carrier, '') as shipping_carrier, created_at, updated_at
		FROM product_orders
		WHERE %s
		ORDER BY created_at DESC LIMIT 20`, productWhere), pArgs...)
	if err == nil {
		rows, _ := handlers.CollectRows(productRows)
		for _, row := range rows {
			if stage, ok := row["fulfillment_status"].(string); ok {
				row["fulfillment_label"] = fulfillmentLabel(stage)
			}
			results = append(results, result{Type: "product", Order: row})
		}
	}

	// Build dynamic WHERE for QR orders.
	qConds := []string{"o.payment_status = 'paid'"}
	qArgs := []any{}
	j := 1
	if invoice != "" {
		qConds = append(qConds, fmt.Sprintf("o.qr_name ILIKE $%d", j))
		qArgs = append(qArgs, "%"+invoice+"%")
		j++
	}
	if name != "" {
		qConds = append(qConds, fmt.Sprintf("o.customer_name ILIKE $%d", j))
		qArgs = append(qArgs, "%"+name+"%")
		j++
	}
	if phone != "" {
		qConds = append(qConds, fmt.Sprintf("o.customer_phone ILIKE $%d", j))
		qArgs = append(qArgs, "%"+phone+"%")
		j++
	}
	qrWhere := strings.Join(qConds, " AND ")

	qrRows, err := config.DB.Query(context.Background(),
		fmt.Sprintf(`SELECT o.id, o.qr_name, o.customer_name, o.customer_phone, o.customer_address,
		       o.total_amount, o.payment_status,
		       COALESCE(o.keychain_delivery_status, 'new') as fulfillment_status,
		       COALESCE(o.tracking_code, '') as tracking_code,
		       COALESCE(o.shipping_carrier, '') as shipping_carrier, o.created_at,
		       q.template_data
		FROM orders o
		LEFT JOIN qr_codes q ON q.qr_name = o.qr_name
		WHERE %s
		ORDER BY o.created_at DESC LIMIT 20`, qrWhere), qArgs...)
	if err == nil {
		rows, _ := handlers.CollectRows(qrRows)
		for _, row := range rows {
			if stage, ok := row["fulfillment_status"].(string); ok {
				row["fulfillment_label"] = fulfillmentLabel(stage)
			}
			results = append(results, result{Type: "qr", Order: row})
		}
	}

	if len(results) == 0 {
		handlers.JSON(w, 404, map[string]any{"success": false, "error": "Không tìm thấy đơn hàng"})
		return
	}
	handlers.OK(w, map[string]any{"success": true, "results": results})
}

// PATCH /api/admin/product-orders/:id/items — admin edits items (notes, images) and/or customer info.
func UpdateProductOrderItems(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Items           json.RawMessage `json:"items"`
		CustomerName    string          `json:"customer_name"`
		CustomerPhone   string          `json:"customer_phone"`
		CustomerAddress string          `json:"customer_address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	setClauses := []string{"updated_at = NOW()"}
	values := []any{}
	idx := 1

	if len(body.Items) > 0 {
		setClauses = append([]string{fmt.Sprintf("items = $%d", idx)}, setClauses...)
		values = append(values, string(body.Items))
		idx++
	}
	if body.CustomerName != "" {
		setClauses = append([]string{fmt.Sprintf("customer_name = $%d", idx)}, setClauses...)
		values = append(values, body.CustomerName)
		idx++
	}
	if body.CustomerPhone != "" {
		setClauses = append([]string{fmt.Sprintf("customer_phone = $%d", idx)}, setClauses...)
		values = append(values, body.CustomerPhone)
		idx++
	}
	if body.CustomerAddress != "" {
		setClauses = append([]string{fmt.Sprintf("customer_address = $%d", idx)}, setClauses...)
		values = append(values, body.CustomerAddress)
		idx++
	}

	values = append(values, id)
	_, err := config.DB.Exec(context.Background(),
		fmt.Sprintf("UPDATE product_orders SET %s WHERE id = $%d",
			joinClauses(setClauses), idx),
		values...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// Advances the keychain fulfillment stage for a QR order. Mirrors UpdateFulfillmentStatus for product orders.
func UpdateQRKeychainFulfillment(w http.ResponseWriter, r *http.Request) {
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
	if body.FulfillmentStatus == "shipped" && strings.TrimSpace(body.TrackingCode) == "" {
		handlers.BadRequest(w, "tracking_code is required when shipped")
		return
	}
	shippingCarrier := strings.TrimSpace(body.ShippingCarrier)
	if shippingCarrier == "" {
		shippingCarrier = "SPX"
	}

	rows, err := config.DB.Query(context.Background(), `
		UPDATE orders
		SET keychain_delivery_status = $1::varchar,
		    tracking_code            = CASE WHEN $1::varchar = 'shipped' THEN $2 ELSE tracking_code END,
		    shipping_carrier         = CASE WHEN $1::varchar = 'shipped' THEN $3 ELSE shipping_carrier END,
		    updated_at               = NOW()
		WHERE id = $4 AND payment_status = 'paid' AND keychain_purchased = true
		RETURNING id, qr_name, customer_name, keychain_delivery_status, tracking_code, shipping_carrier`,
		body.FulfillmentStatus, body.TrackingCode, shippingCarrier, id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	order, err := handlers.CollectOne(rows)
	if err != nil || order == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "order": order})
}

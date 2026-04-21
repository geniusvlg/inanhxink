package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

func adminDomain() string {
	if d := os.Getenv("DOMAIN"); d != "" {
		return d
	}
	return "inanhxink.com"
}

// GET /api/admin/orders?page=&limit=&payment_status=&status=
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
	if v := q.Get("status"); v != "" {
		conditions = append(conditions, fmt.Sprintf("o.status = $%d", idx))
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
		Status        string `json:"status"`
		PaymentStatus string `json:"payment_status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	setClauses := []string{}
	values := []any{}
	i := 1
	if body.Status != "" {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", i))
		values = append(values, body.Status)
		i++
	}
	if body.PaymentStatus != "" {
		setClauses = append(setClauses, fmt.Sprintf("payment_status = $%d", i))
		values = append(values, body.PaymentStatus)
		i++
	}
	if len(setClauses) == 0 {
		handlers.BadRequest(w, "status or payment_status required")
		return
	}
	values = append(values, id)

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

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
	handlers.OK(w, map[string]any{"success": true, "order": order})
}

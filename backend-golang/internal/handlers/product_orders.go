package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

// OrderItem represents one line in the cart.
type OrderItem struct {
	ProductID   int      `json:"product_id"`
	ProductName string   `json:"product_name"`
	Quantity    int      `json:"quantity"`
	UnitPrice   float64  `json:"unit_price"`
	ImageURLs   []string `json:"image_urls"`
	Note        string   `json:"note"`
}

// POST /api/product-orders
// Idempotent via cart_session_id (UUID from localStorage).
func CreateProductOrder(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CartSessionID   string      `json:"cart_session_id"`
		CustomerName    string      `json:"customer_name"`
		CustomerPhone   string      `json:"customer_phone"`
		CustomerEmail   string      `json:"customer_email"`
		CustomerAddress string      `json:"customer_address"`
		Items           []OrderItem `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "Invalid JSON")
		return
	}

	body.CartSessionID = strings.TrimSpace(body.CartSessionID)
	body.CustomerName = strings.TrimSpace(body.CustomerName)
	body.CustomerPhone = strings.TrimSpace(body.CustomerPhone)
	body.CustomerAddress = strings.TrimSpace(body.CustomerAddress)

	if body.CartSessionID == "" {
		BadRequest(w, "cart_session_id is required")
		return
	}
	if body.CustomerName == "" || body.CustomerPhone == "" || body.CustomerAddress == "" {
		BadRequest(w, "customer_name, customer_phone, customer_address are required")
		return
	}
	if len(body.Items) == 0 {
		BadRequest(w, "items must not be empty")
		return
	}
	for _, it := range body.Items {
		if it.Quantity < 1 {
			BadRequest(w, "each item must have quantity >= 1")
			return
		}
		if it.UnitPrice < 0 {
			BadRequest(w, "unit_price must be >= 0")
			return
		}
	}

	var subtotal float64
	for _, it := range body.Items {
		subtotal += float64(it.Quantity) * it.UnitPrice
	}
	total := math.Round(subtotal)
	subtotal = math.Round(subtotal)

	itemsJSON, err := json.Marshal(body.Items)
	if err != nil {
		InternalError(w, err)
		return
	}

	// Upsert: if same cart_session_id is submitted twice, update and return existing row.
	row := config.DB.QueryRow(context.Background(), `
		INSERT INTO product_orders
			(cart_session_id, customer_name, customer_phone, customer_email,
			 customer_address, items, subtotal, total_amount)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (cart_session_id) DO UPDATE SET
			customer_name    = EXCLUDED.customer_name,
			customer_phone   = EXCLUDED.customer_phone,
			customer_email   = EXCLUDED.customer_email,
			customer_address = EXCLUDED.customer_address,
			items            = EXCLUDED.items,
			subtotal         = EXCLUDED.subtotal,
			total_amount     = EXCLUDED.total_amount,
			updated_at       = NOW()
		RETURNING id`,
		body.CartSessionID, body.CustomerName, body.CustomerPhone,
		nullStr(body.CustomerEmail), body.CustomerAddress,
		string(itemsJSON), subtotal, total,
	)
	var orderID int
	if err := row.Scan(&orderID); err != nil {
		InternalError(w, err)
		return
	}

	// Set invoice_number now that we have the ID.
	invoiceNumber := fmt.Sprintf("SHOP%d", orderID)
	config.DB.Exec(context.Background(), //nolint
		"UPDATE product_orders SET invoice_number = $1 WHERE id = $2 AND invoice_number IS NULL",
		invoiceNumber, orderID)

	Created(w, map[string]any{
		"success":       true,
		"order_id":      orderID,
		"invoice_number": invoiceNumber,
		"total_amount":  total,
	})
}

// GET /api/product-orders/:id
func GetProductOrder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM product_orders WHERE id = $1", id)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found"})
		return
	}
	OK(w, map[string]any{"success": true, "order": row})
}

package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"inanhxink/backend-golang/internal/config"
)

const MaxProductReviewCommentLen = 2000

func orderItemsContainProduct(itemsJSON []byte, productID int) bool {
	var items []OrderItem
	if err := json.Unmarshal(itemsJSON, &items); err != nil {
		return false
	}
	for _, it := range items {
		if it.ProductID == productID {
			return true
		}
	}
	return false
}

// GET /api/products/:id/reviews?page=&limit=
func ListProductReviews(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	productID, err := strconv.Atoi(idStr)
	if err != nil || productID < 1 {
		BadRequest(w, "invalid product id")
		return
	}

	q := r.URL.Query()
	page := Clamp(IntParam(q.Get("page"), 1), 1, 1<<20)
	limit := Clamp(IntParam(q.Get("limit"), 10), 1, 50)
	offset := (page - 1) * limit

	var total int
	if err := config.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`, productID).Scan(&total); err != nil {
		InternalError(w, err)
		return
	}

	rows, err := config.DB.Query(context.Background(), `
		SELECT
			r.id,
			r.rating,
			r.comment,
			r.created_at,
			CASE WHEN r.is_admin_entry THEN r.display_customer_name ELSE po.customer_name END AS customer_name,
			CASE WHEN r.is_admin_entry THEN COALESCE(r.display_invoice, '') ELSE COALESCE(po.invoice_number, '') END AS invoice_number,
			CASE
				WHEN r.is_admin_entry THEN
					NULLIF(TRIM(
						CASE
							WHEN r.display_ordered_product IS NOT NULL AND strpos(r.display_ordered_product, ' — ') > 0
								THEN split_part(r.display_ordered_product, ' — ', 2)
							WHEN r.display_ordered_product IS NOT NULL AND strpos(r.display_ordered_product, ' – ') > 0
								THEN split_part(r.display_ordered_product, ' – ', 2)
							WHEN r.display_ordered_product IS NOT NULL AND strpos(r.display_ordered_product, ' - ') > 0
								THEN split_part(r.display_ordered_product, ' - ', 2)
							ELSE COALESCE(NULLIF(TRIM(r.display_ordered_product), ''), '')
						END
					), '')
				ELSE NULLIF(TRIM((
					SELECT COALESCE(
						NULLIF(TRIM(elem->>'variant_name'), ''),
						(SELECT pv.name::text FROM product_variants pv
						 WHERE pv.product_id = r.product_id
						   AND (elem->>'variant_id') ~ '^[0-9]+$'
						   AND pv.id = (elem->>'variant_id')::int
						 LIMIT 1)
					)
					FROM jsonb_array_elements(po.items) AS elem
					WHERE (elem->>'product_id')::int = r.product_id
					LIMIT 1
				)), '')
			END AS variant_name,
			CASE
				WHEN r.is_admin_entry THEN NULL::integer
				ELSE (
					SELECT CASE
						WHEN (elem->>'variant_id') ~ '^[0-9]+$' THEN (elem->>'variant_id')::int
						ELSE NULL
					END
					FROM jsonb_array_elements(po.items) AS elem
					WHERE (elem->>'product_id')::int = r.product_id
					LIMIT 1
				)
			END AS variant_id
		FROM product_reviews r
		LEFT JOIN product_orders po ON po.id = r.product_order_id
		WHERE r.product_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3`,
		productID, limit, offset)
	if err != nil {
		InternalError(w, err)
		return
	}
	reviews, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	if reviews == nil {
		reviews = []map[string]any{}
	}
	OK(w, map[string]any{"success": true, "reviews": reviews, "total": total, "page": page, "limit": limit})
}

// POST /api/products/:id/reviews
// Body: { "invoice_number": "INXK...", "rating": 1-5, "comment": "..." }
// Requires a paid product order whose line items include this product. One review per (order, product).
func CreateProductReview(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	productID, err := strconv.Atoi(idStr)
	if err != nil || productID < 1 {
		BadRequest(w, "invalid product id")
		return
	}

	var body struct {
		InvoiceNumber string `json:"invoice_number"`
		Rating        int    `json:"rating"`
		Comment       string `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "Invalid JSON")
		return
	}

	inv := strings.TrimSpace(body.InvoiceNumber)
	body.Comment = strings.TrimSpace(body.Comment)
	if inv == "" {
		BadRequest(w, "invoice_number is required")
		return
	}
	if body.Rating < 1 || body.Rating > 5 {
		BadRequest(w, "rating must be between 1 and 5")
		return
	}
	if body.Comment == "" {
		BadRequest(w, "comment is required")
		return
	}
	if len(body.Comment) > MaxProductReviewCommentLen {
		BadRequest(w, "comment is too long")
		return
	}

	var matchCount int
	if err := config.DB.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM product_orders
		WHERE invoice_number IS NOT NULL
		  AND LOWER(TRIM(invoice_number)) = LOWER(TRIM($1))`, inv).Scan(&matchCount); err != nil {
		InternalError(w, err)
		return
	}
	if matchCount == 0 {
		BadRequest(w, "Không tìm thấy đơn hàng với mã hóa đơn này")
		return
	}
	if matchCount > 1 {
		BadRequest(w, "Mã hóa đơn không duy nhất — vui lòng liên hệ shop")
		return
	}

	var orderID int
	var itemsJSON []byte
	var payStatus string
	err = config.DB.QueryRow(context.Background(), `
		SELECT id, items::text, payment_status
		FROM product_orders
		WHERE invoice_number IS NOT NULL
		  AND LOWER(TRIM(invoice_number)) = LOWER(TRIM($1))`,
		inv).Scan(&orderID, &itemsJSON, &payStatus)
	if err != nil {
		InternalError(w, err)
		return
	}

	if payStatus != "paid" {
		BadRequest(w, "Chỉ đơn đã thanh toán mới được đánh giá")
		return
	}

	if !orderItemsContainProduct(itemsJSON, productID) {
		BadRequest(w, "Đơn hàng này không có sản phẩm bạn đang xem")
		return
	}

	_, err = config.DB.Exec(context.Background(), `
		INSERT INTO product_reviews (product_order_id, product_id, rating, comment)
		VALUES ($1, $2, $3, $4)`,
		orderID, productID, body.Rating, body.Comment)
	if err != nil {
		var pe *pgconn.PgError
		if errors.As(err, &pe) && pe.Code == "23505" {
			Conflict(w, "Bạn đã gửi đánh giá cho sản phẩm này với mã hóa đơn này rồi")
			return
		}
		InternalError(w, err)
		return
	}

	Created(w, map[string]any{"success": true})
}

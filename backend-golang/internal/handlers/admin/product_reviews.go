package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

const adminProductReviewsMaxLimit = 100

func reviewListSelectColumns() string {
	return `
		r.id,
		r.rating,
		r.comment,
		r.created_at,
		r.is_admin_entry,
		CASE WHEN r.is_admin_entry THEN r.display_customer_name ELSE po.customer_name END AS customer_name,
		CASE WHEN r.is_admin_entry THEN COALESCE(r.display_invoice, '') ELSE COALESCE(po.invoice_number, '') END AS invoice_number,
		CASE
			WHEN r.is_admin_entry THEN COALESCE(NULLIF(TRIM(r.display_ordered_product), ''), p.name)
			ELSE COALESCE(
				NULLIF(TRIM((
					SELECT
						COALESCE(NULLIF(TRIM(elem->>'product_name'), ''), '') ||
						CASE
							WHEN NULLIF(TRIM(elem->>'variant_name'), '') IS NOT NULL
							THEN ' — ' || TRIM(elem->>'variant_name')
							ELSE ''
						END
					FROM jsonb_array_elements(po.items) AS elem
					WHERE (elem->>'product_id')::int = r.product_id
					LIMIT 1
				)), ''),
				p.name
			)
		END AS ordered_product_label,
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
	`
}

// GET /api/admin/products/:id/reviews?limit=&page=
func ListAdminProductReviews(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || productID < 1 {
		handlers.BadRequest(w, "invalid product id")
		return
	}
	q := r.URL.Query()
	page := handlers.Clamp(handlers.IntParam(q.Get("page"), 1), 1, 1<<20)
	limit := handlers.Clamp(handlers.IntParam(q.Get("limit"), 50), 1, adminProductReviewsMaxLimit)
	offset := (page - 1) * limit

	var total int
	if err := config.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM product_reviews WHERE product_id = $1`, productID).Scan(&total); err != nil {
		handlers.InternalError(w, err)
		return
	}

	rows, err := config.DB.Query(context.Background(), fmt.Sprintf(`
		SELECT %s
		FROM product_reviews r
		LEFT JOIN product_orders po ON po.id = r.product_order_id
		LEFT JOIN products p ON p.id = r.product_id
		WHERE r.product_id = $1
		ORDER BY r.created_at DESC
		LIMIT $2 OFFSET $3`, reviewListSelectColumns()),
		productID, limit, offset)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	reviews, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if reviews == nil {
		reviews = []map[string]any{}
	}
	handlers.OK(w, map[string]any{"success": true, "reviews": reviews, "total": total, "page": page, "limit": limit})
}

// POST /api/admin/products/:id/reviews — seed a display-only review (no real order).
func CreateAdminProductReview(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || productID < 1 {
		handlers.BadRequest(w, "invalid product id")
		return
	}

	var body struct {
		Rating                int    `json:"rating"`
		Comment               string `json:"comment"`
		CustomerName          string `json:"customer_name"`
		InvoiceNumber         string `json:"invoice_number"`
		OrderedProductLabel   string `json:"ordered_product_label"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	body.Comment = strings.TrimSpace(body.Comment)
	body.CustomerName = strings.TrimSpace(body.CustomerName)
	body.InvoiceNumber = strings.TrimSpace(body.InvoiceNumber)
	body.OrderedProductLabel = strings.TrimSpace(body.OrderedProductLabel)

	if body.Rating < 1 || body.Rating > 5 {
		handlers.BadRequest(w, "rating must be between 1 and 5")
		return
	}
	if body.Comment == "" {
		handlers.BadRequest(w, "comment is required")
		return
	}
	if len(body.Comment) > handlers.MaxProductReviewCommentLen {
		handlers.BadRequest(w, "comment is too long")
		return
	}
	if body.CustomerName == "" || body.InvoiceNumber == "" || body.OrderedProductLabel == "" {
		handlers.BadRequest(w, "customer_name, invoice_number, ordered_product_label are required")
		return
	}

	var n int
	if err := config.DB.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM products WHERE id = $1 AND is_draft = false`, productID).Scan(&n); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if n == 0 {
		handlers.NotFound(w)
		return
	}

	_, err = config.DB.Exec(context.Background(), `
		INSERT INTO product_reviews (
			product_order_id, product_id, rating, comment,
			is_admin_entry, display_customer_name, display_invoice, display_ordered_product
		) VALUES (NULL, $1, $2, $3, TRUE, $4, $5, $6)`,
		productID, body.Rating, body.Comment, body.CustomerName, body.InvoiceNumber, body.OrderedProductLabel)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true})
}

// DELETE /api/admin/products/:id/reviews/:reviewId
func DeleteAdminProductReview(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || productID < 1 {
		handlers.BadRequest(w, "invalid product id")
		return
	}
	reviewID, err := strconv.Atoi(chi.URLParam(r, "reviewId"))
	if err != nil || reviewID < 1 {
		handlers.BadRequest(w, "invalid review id")
		return
	}

	cmd, err := config.DB.Exec(context.Background(), `
		DELETE FROM product_reviews WHERE id = $1 AND product_id = $2`,
		reviewID, productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if cmd.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

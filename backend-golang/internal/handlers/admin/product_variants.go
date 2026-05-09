package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/products/:id/variants
func ListProductVariants(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, product_id, name, price, discount_price, discount_from, discount_to, image, sort_order, created_at
		FROM product_variants
		WHERE product_id = $1
		ORDER BY sort_order ASC, id ASC`, productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	variants, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if variants == nil {
		variants = []map[string]any{}
	}
	handlers.OK(w, map[string]any{"success": true, "variants": variants})
}

// PUT /api/admin/products/:id/variants
// Replaces all variants for the product. Body: [{id?, name, price, discount_price?, discount_from?, discount_to?, image?, sort_order?}]
func UpsertProductVariants(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")

	var body []struct {
		ID            *int    `json:"id"`
		Name          string  `json:"name"`
		Price         float64 `json:"price"`
		DiscountPrice *float64 `json:"discount_price"`
		DiscountFrom  *string  `json:"discount_from"`
		DiscountTo    *string  `json:"discount_to"`
		Image         *string `json:"image"`
		SortOrder     int     `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON: expected array of variants")
		return
	}

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	// Collect IDs that are being kept (have an ID in the payload)
	keptIDs := []int{}
	for _, v := range body {
		if v.ID != nil {
			keptIDs = append(keptIDs, *v.ID)
		}
	}

	// Delete variants not in the kept set
	if len(keptIDs) == 0 {
		tx.Exec(context.Background(), //nolint
			"DELETE FROM product_variants WHERE product_id = $1", productID)
	} else {
		tx.Exec(context.Background(), //nolint
			"DELETE FROM product_variants WHERE product_id = $1 AND id != ALL($2::int[])", productID, keptIDs)
	}

	// Upsert each variant
	for i, v := range body {
		sortOrder := v.SortOrder
		if sortOrder == 0 {
			sortOrder = i
		}
		if v.ID != nil {
			// Update existing
			tx.Exec(context.Background(), //nolint
				`UPDATE product_variants
				 SET name=$1, price=$2, discount_price=$3, discount_from=$4, discount_to=$5, image=$6, sort_order=$7
				 WHERE id=$8 AND product_id=$9`,
				v.Name, v.Price, v.DiscountPrice, v.DiscountFrom, v.DiscountTo, v.Image, sortOrder, *v.ID, productID)
		} else {
			// Insert new
			tx.Exec(context.Background(), //nolint
				`INSERT INTO product_variants (product_id, name, price, discount_price, discount_from, discount_to, image, sort_order)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
				productID, v.Name, v.Price, v.DiscountPrice, v.DiscountFrom, v.DiscountTo, v.Image, sortOrder)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}

	// Return updated list
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, product_id, name, price, discount_price, discount_from, discount_to, image, sort_order, created_at
		FROM product_variants
		WHERE product_id = $1
		ORDER BY sort_order ASC, id ASC`, productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	variants, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if variants == nil {
		variants = []map[string]any{}
	}
	handlers.OK(w, map[string]any{"success": true, "variants": variants})
}

// DELETE /api/admin/products/:id/variants/:variantId
func DeleteProductVariant(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	variantID := chi.URLParam(r, "variantId")

	// Validate variantId is numeric
	if _, err := strconv.Atoi(variantID); err != nil {
		handlers.BadRequest(w, "invalid variantId")
		return
	}

	result, err := config.DB.Exec(context.Background(),
		"DELETE FROM product_variants WHERE id = $1 AND product_id = $2", variantID, productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if result.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

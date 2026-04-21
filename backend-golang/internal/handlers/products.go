package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

func rewriteProductCDN(row map[string]any) {
	config.CdnArrayField(row, "images")
}

// GET /api/products?type=&category_ids=1,2&min_price=&max_price=&sort=&page=&limit=
func ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := Clamp(IntParam(q.Get("page"), 1), 1, 1<<30)
	limit := Clamp(IntParam(q.Get("limit"), 12), 1, 48)
	offset := (page - 1) * limit

	params := []any{}
	conditions := []string{"p.is_active = true", "p.is_draft = false"}

	if t := q.Get("type"); t != "" {
		params = append(params, t)
		conditions = append(conditions, fmt.Sprintf("p.type = $%d", len(params)))
	}
	if v := q.Get("min_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			params = append(params, n)
			conditions = append(conditions, fmt.Sprintf("p.price >= $%d", len(params)))
		}
	}
	if v := q.Get("max_price"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			params = append(params, n)
			conditions = append(conditions, fmt.Sprintf("p.price <= $%d", len(params)))
		}
	}
	if v := q.Get("category_ids"); v != "" {
		ids := parseIntList(v)
		if len(ids) > 0 {
			params = append(params, ids)
			conditions = append(conditions, fmt.Sprintf(
				"p.id IN (SELECT product_id FROM product_category_map WHERE category_id = ANY($%d::int[]))", len(params),
			))
		}
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	orderBy := "ORDER BY p.updated_at DESC, p.created_at DESC"
	switch q.Get("sort") {
	case "price_asc":
		orderBy = "ORDER BY p.price ASC, p.updated_at DESC"
	case "price_desc":
		orderBy = "ORDER BY p.price DESC, p.updated_at DESC"
	}

	countRow := config.DB.QueryRow(
		context.Background(),
		fmt.Sprintf(`SELECT COUNT(DISTINCT p.id) AS total FROM products p LEFT JOIN product_category_map m ON m.product_id = p.id %s`, where),
		params...,
	)
	var total int
	if err := countRow.Scan(&total); err != nil {
		InternalError(w, err)
		return
	}

	params = append(params, limit, offset)
	rows, err := config.DB.Query(
		context.Background(),
		fmt.Sprintf(`SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_best_seller,
			p.tiktok_url, p.instagram_url, p.discount_price, p.discount_from, p.discount_to,
			COALESCE(json_agg(json_build_object('id', pc.id, 'name', pc.name)) FILTER (WHERE pc.id IS NOT NULL), '[]') AS categories
		FROM products p
		LEFT JOIN product_category_map m  ON m.product_id  = p.id
		LEFT JOIN product_categories   pc ON pc.id = m.category_id
		%s GROUP BY p.id %s
		LIMIT $%d OFFSET $%d`, where, orderBy, len(params)-1, len(params)),
		params...,
	)
	if err != nil {
		InternalError(w, err)
		return
	}
	products, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, p := range products {
		rewriteProductCDN(p)
	}
	OK(w, map[string]any{"success": true, "products": products, "total": total, "page": page, "limit": limit})
}

// GET /api/products/featured-on-home
func ListFeaturedProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), `
		SELECT p.id, p.name, p.description, p.price, p.images, p.type,
			p.is_best_seller, p.tiktok_url, p.instagram_url,
			p.discount_price, p.discount_from, p.discount_to, p.home_sort_order,
			COALESCE(json_agg(json_build_object('id', pc.id, 'name', pc.name)) FILTER (WHERE pc.id IS NOT NULL), '[]') AS categories
		FROM products p
		LEFT JOIN product_category_map m  ON m.product_id  = p.id
		LEFT JOIN product_categories   pc ON pc.id = m.category_id
		WHERE p.is_active = TRUE AND p.is_draft = FALSE AND p.is_featured_on_home = TRUE
		GROUP BY p.id ORDER BY p.home_sort_order ASC, p.id ASC`)
	if err != nil {
		InternalError(w, err)
		return
	}
	products, err := CollectRows(rows)
	if err != nil {
		InternalError(w, err)
		return
	}
	for _, p := range products {
		rewriteProductCDN(p)
	}
	OK(w, map[string]any{"success": true, "products": products})
}

// GET /api/products/:id
func GetProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(), `
		SELECT p.id, p.name, p.description, p.price, p.images, p.type, p.is_active,
			p.is_best_seller, p.tiktok_url, p.instagram_url, p.created_at,
			p.discount_price, p.discount_from, p.discount_to,
			COALESCE(json_agg(json_build_object('id', pc.id, 'name', pc.name)) FILTER (WHERE pc.id IS NOT NULL), '[]') AS categories
		FROM products p
		LEFT JOIN product_category_map m  ON m.product_id  = p.id
		LEFT JOIN product_categories   pc ON pc.id = m.category_id
		WHERE p.id = $1 AND p.is_active = true AND p.is_draft = false
		GROUP BY p.id`, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		NotFound(w)
		return
	}
	rewriteProductCDN(row)
	OK(w, map[string]any{"success": true, "product": row})
}

func parseIntList(s string) []int {
	parts := strings.Split(s, ",")
	var ids []int
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			ids = append(ids, n)
		}
	}
	return ids
}

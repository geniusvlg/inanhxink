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

const productSelectWithCategories = `
	SELECT p.*,
		COALESCE(json_agg(json_build_object('id', pc.id, 'name', pc.name))
			FILTER (WHERE pc.id IS NOT NULL), '[]') AS categories
	FROM products p
	LEFT JOIN product_category_map m  ON m.product_id  = p.id
	LEFT JOIN product_categories   pc ON pc.id = m.category_id`

// GET /api/admin/products?type=&page=&limit=
func ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := handlers.Clamp(handlers.IntParam(q.Get("page"), 1), 1, 1<<30)
	limit := handlers.Clamp(handlers.IntParam(q.Get("limit"), 20), 1, 100)
	offset := (page - 1) * limit

	conditions := []string{"p.is_draft = false"}
	params := []any{}
	idx := 1
	if t := q.Get("type"); t != "" {
		params = append(params, t)
		conditions = append(conditions, fmt.Sprintf("p.type = $%d", idx))
		idx++
	}
	where := "WHERE " + joinClauses(conditions)

	countRow := config.DB.QueryRow(context.Background(),
		fmt.Sprintf("SELECT COUNT(DISTINCT p.id) AS total FROM products p %s", where), params...)
	var total int
	countRow.Scan(&total) //nolint

	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf(`%s %s GROUP BY p.id ORDER BY p.updated_at DESC, p.created_at DESC LIMIT $%d OFFSET $%d`,
			productSelectWithCategories, where, idx, idx+1),
		append(params, limit, offset)...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	products, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "products": products, "total": total, "page": page, "limit": limit})
}

// GET /api/admin/products/featured-on-home
func ListFeaturedProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), productSelectWithCategories+`
		WHERE p.is_featured_on_home = TRUE
		GROUP BY p.id ORDER BY p.home_sort_order ASC, p.id ASC`)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	products, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "products": products})
}

// PATCH /api/admin/products/featured-on-home/reorder
func ReorderFeaturedProducts(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Items []struct {
			ID        int `json:"id"`
			SortOrder int `json:"sort_order"`
		} `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.Items) == 0 {
		handlers.BadRequest(w, "items array required")
		return
	}
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint
	for _, it := range body.Items {
		tx.Exec(context.Background(), //nolint
			"UPDATE products SET home_sort_order = $1 WHERE id = $2 AND is_featured_on_home = TRUE",
			it.SortOrder, it.ID)
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true})
}

// GET /api/admin/products/:id
func GetProduct(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		productSelectWithCategories+` WHERE p.id = $1 GROUP BY p.id`, chi.URLParam(r, "id"))
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "product": row})
}

// POST /api/admin/products/check-name
func CheckProductName(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" || body.Type == "" {
		handlers.BadRequest(w, "name and type are required")
		return
	}
	var id int
	err := config.DB.QueryRow(context.Background(),
		"SELECT id FROM products WHERE LOWER(name) = LOWER($1) AND type = $2 AND is_draft = false LIMIT 1",
		body.Name, body.Type).Scan(&id)
	if err == nil {
		handlers.OK(w, map[string]any{"success": true, "available": false, "message": "Tên sản phẩm đã tồn tại"})
		return
	}
	handlers.OK(w, map[string]any{"success": true, "available": true})
}

// POST /api/admin/products/reserve — creates a draft product to get an ID for S3 uploads.
func ReserveProduct(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
		Type string `json:"type"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Name == "" || body.Type == "" {
		handlers.BadRequest(w, "name and type are required")
		return
	}
	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint
	var productID int
	if err := tx.QueryRow(context.Background(), `
		INSERT INTO products (name, type, price, images, is_active, is_draft)
		VALUES ($1, $2, 0, '[]', false, true) RETURNING id`,
		body.Name, body.Type).Scan(&productID); err != nil {
		handlers.InternalError(w, err)
		return
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true, "productId": productID})
}

// POST /api/admin/products
func CreateProduct(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	name, _ := body["name"].(string)
	productType, _ := body["type"].(string)
	price := body["price"]
	if name == "" || price == nil || productType == "" {
		handlers.BadRequest(w, "name, price, type required")
		return
	}

	isFeaturedOnHome, _ := body["is_featured_on_home"].(bool)

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	homeSortOrder := 0
	if isFeaturedOnHome {
		tx.QueryRow(context.Background(), //nolint
			"SELECT COALESCE(MAX(home_sort_order), 0) FROM products WHERE is_featured_on_home = TRUE").
			Scan(&homeSortOrder)
		homeSortOrder++
	}

	images := "[]"
	if imgs, ok := body["images"].([]any); ok {
		if b, err := json.Marshal(imgs); err == nil {
			images = string(b)
		}
	}

	isActive := true
	if v, ok := body["is_active"].(bool); ok {
		isActive = v
	}
	isBestSeller, _ := body["is_best_seller"].(bool)
	watermarkEnabled, _ := body["watermark_enabled"].(bool)

	rows, err := tx.Query(context.Background(), `
		INSERT INTO products (name, description, price, images, type, is_active, is_best_seller,
			watermark_enabled, tiktok_url, instagram_url, discount_price, discount_from, discount_to,
			is_featured_on_home, home_sort_order)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
		name, body["description"], price, images, productType, isActive, isBestSeller,
		watermarkEnabled, body["tiktok_url"], body["instagram_url"],
		body["discount_price"], body["discount_from"], body["discount_to"],
		isFeaturedOnHome, homeSortOrder)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	product, _ := handlers.CollectOne(rows)

	if catIDs, ok := body["category_ids"].([]any); ok {
		for _, id := range catIDs {
			tx.Exec(context.Background(), //nolint
				"INSERT INTO product_category_map (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
				product["id"], id)
		}
	}
	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.Created(w, map[string]any{"success": true, "product": product})
}

// PUT /api/admin/products/:id
func UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	allowed := map[string]bool{
		"name": true, "description": true, "price": true, "images": true,
		"is_active": true, "is_best_seller": true, "watermark_enabled": true,
		"tiktok_url": true, "instagram_url": true,
		"discount_price": true, "discount_from": true, "discount_to": true,
	}

	setClauses := []string{}
	values := []any{}
	i := 1

	for k := range allowed {
		if v, ok := body[k]; ok {
			val := v
			if k == "images" {
				if imgs, ok := v.([]any); ok {
					if b, err := json.Marshal(imgs); err == nil {
						val = string(b)
					}
				}
			}
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", k, i))
			values = append(values, val)
			i++
		}
	}

	// Handle is_featured_on_home — append to bottom of order when toggling on
	if v, ok := body["is_featured_on_home"].(bool); ok {
		setClauses = append(setClauses, fmt.Sprintf("is_featured_on_home = $%d", i))
		values = append(values, v)
		i++
		if v {
			var wasFeatured bool
			tx.QueryRow(context.Background(),
				"SELECT is_featured_on_home FROM products WHERE id = $1", id).Scan(&wasFeatured) //nolint
			if !wasFeatured {
				var maxOrder int
				tx.QueryRow(context.Background(), //nolint
					"SELECT COALESCE(MAX(home_sort_order), 0) FROM products WHERE is_featured_on_home = TRUE").
					Scan(&maxOrder)
				setClauses = append(setClauses, fmt.Sprintf("home_sort_order = $%d", i))
				values = append(values, maxOrder+1)
				i++
			}
		}
	}

	// Finalise a reserved draft
	setClauses = append(setClauses, fmt.Sprintf("is_draft = $%d", i))
	values = append(values, false)
	i++

	if len(setClauses) > 0 {
		values = append(values, id)
		if _, err := tx.Exec(context.Background(),
			fmt.Sprintf("UPDATE products SET %s WHERE id = $%d",
				joinClauses(setClauses), len(values)),
			values...); err != nil {
			handlers.InternalError(w, err)
			return
		}
	}

	// Update category mappings
	if catIDs, ok := body["category_ids"].([]any); ok {
		tx.Exec(context.Background(), "DELETE FROM product_category_map WHERE product_id = $1", id) //nolint
		for _, cid := range catIDs {
			tx.Exec(context.Background(), //nolint
				"INSERT INTO product_category_map (product_id, category_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
				id, cid)
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		handlers.InternalError(w, err)
		return
	}

	// Fetch updated product
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM products WHERE id = $1", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	product, err := handlers.CollectOne(rows)
	if err != nil || product == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "product": product})
}

// DELETE /api/admin/products/:id (hard delete)
func DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	result, err := config.DB.Exec(context.Background(),
		"DELETE FROM products WHERE id = $1", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if result.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Product deleted"})
}

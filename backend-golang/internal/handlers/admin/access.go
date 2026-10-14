package admin

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/authz"
	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
	"inanhxink/backend-golang/internal/middleware"
)

// allowProductAction writes 400 for an unknown type and 403 when the action is missing.
func allowProductAction(w http.ResponseWriter, r *http.Request, productType, action string) bool {
	area, ok := authz.AreaForProductType(productType)
	if !ok {
		handlers.BadRequest(w, "invalid type")
		return false
	}
	if !middleware.GetAdmin(r).Can(area + "." + action) {
		handlers.Forbidden(w)
		return false
	}
	return true
}

// allowProductByID loads products.type for the {id} URL param and checks action.
func allowProductByID(w http.ResponseWriter, r *http.Request, action string) bool {
	var productType string
	err := config.DB.QueryRow(context.Background(),
		`SELECT type FROM products WHERE id = $1`, chi.URLParam(r, "id")).Scan(&productType)
	if err == pgx.ErrNoRows {
		handlers.NotFound(w)
		return false
	}
	if err != nil {
		handlers.InternalError(w, err)
		return false
	}
	return allowProductAction(w, r, productType, action)
}

// allowProductList allows a product-type page or the reviews page to read that type.
func allowProductList(w http.ResponseWriter, r *http.Request, productType string) bool {
	area, ok := authz.AreaForProductType(productType)
	if !ok {
		handlers.BadRequest(w, "invalid type")
		return false
	}
	p := middleware.GetAdmin(r)
	if p.Can(area+".view") || p.Can("product_reviews.view") {
		return true
	}
	handlers.Forbidden(w)
	return false
}

// viewableProductTypes is every products.type the account may list.
// A reviews-only account can list every type so the reviews page can pick a product.
func viewableProductTypes(r *http.Request) []string {
	p := middleware.GetAdmin(r)
	if p.Can("product_reviews.view") {
		return authz.ProductTypesForAreas(map[string]struct{}{
			"thiep": {}, "khung_anh": {}, "so_scrapbook": {}, "khac": {}, "set_qua_tang": {}, "in_anh": {},
		})
	}
	allowed := map[string]struct{}{}
	for _, area := range []string{"thiep", "khung_anh", "so_scrapbook", "khac", "set_qua_tang", "in_anh"} {
		if p.Can(area + ".view") {
			allowed[area] = struct{}{}
		}
	}
	return authz.ProductTypesForAreas(allowed)
}

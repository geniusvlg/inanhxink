// Package authz is the fixed catalog of admin permission keys.
// Assignments live in role_permission; this list is the only set that can be stored.
package authz

// Area is one admin screen and the actions that screen actually has.
type Area struct {
	Key     string   `json:"key"`
	Label   string   `json:"label"`
	Actions []string `json:"actions"`
}

// Catalog is the role-editor checklist, in sidebar order.
// Nhân viên and Vai trò are not here: only the system Admin role can manage them.
var Catalog = []Area{
	{Key: "qr_templates", Label: "QR Templates", Actions: crud},
	{Key: "thiep", Label: "Thiệp", Actions: crud},
	{Key: "khung_anh", Label: "Khung Ảnh", Actions: crud},
	{Key: "so_scrapbook", Label: "Sổ & Scrapbook", Actions: crud},
	{Key: "khac", Label: "Các sản phẩm khác", Actions: crud},
	{Key: "set_qua_tang", Label: "Set quà tặng", Actions: crud},
	{Key: "in_anh", Label: "In Ảnh", Actions: crud},
	{Key: "featured", Label: "SP trang chủ", Actions: viewUpdate},
	{Key: "categories", Label: "Danh mục", Actions: crud},
	{Key: "product_reviews", Label: "Đánh giá SP", Actions: []string{View, Create, Delete}},
	{Key: "product_orders", Label: "Đơn sản phẩm", Actions: viewUpdate},
	{Key: "fulfillment", Label: "Xử lý đơn hàng", Actions: viewUpdate},
	{Key: "qr_orders", Label: "Đơn QR", Actions: viewUpdate},
	{Key: "vouchers", Label: "Voucher", Actions: crud},
	{Key: "testimonials", Label: "Feedback", Actions: crud},
	{Key: "banners", Label: "Banner", Actions: crud},
	{Key: "hero_shots", Label: "Polaroid trang chủ", Actions: viewUpdate},
	{Key: "config", Label: "Cấu hình", Actions: viewUpdate},
}

const (
	View   = "view"
	Create = "create"
	Update = "update"
	Delete = "delete"
)

var (
	crud       = []string{View, Create, Update, Delete}
	viewUpdate = []string{View, Update}
)

// productAreas maps the products.type column to a catalog area.
var productAreas = map[string]string{
	"thiep":        "thiep",
	"khung_anh":    "khung_anh",
	"so_scrapbook": "so_scrapbook",
	"khac":         "khac",
	"set-qua-tang": "set_qua_tang",
	"in_anh":       "in_anh",
}

// Known reports whether key is in the catalog.
func Known(key string) bool {
	for _, area := range Catalog {
		for _, action := range area.Actions {
			if area.Key+"."+action == key {
				return true
			}
		}
	}
	return false
}

// AllKeys returns every catalog key. The system Admin role receives all of them.
func AllKeys() []string {
	keys := make([]string, 0, 64)
	for _, area := range Catalog {
		for _, action := range area.Actions {
			keys = append(keys, area.Key+"."+action)
		}
	}
	return keys
}

// AreaForProductType returns the permission area for a products.type value.
func AreaForProductType(productType string) (string, bool) {
	area, ok := productAreas[productType]
	return area, ok
}

// ProductTypesForAreas returns products.type values whose area is in allowed.
func ProductTypesForAreas(allowed map[string]struct{}) []string {
	types := make([]string, 0, len(productAreas))
	for productType, area := range productAreas {
		if _, ok := allowed[area]; ok {
			types = append(types, productType)
		}
	}
	return types
}

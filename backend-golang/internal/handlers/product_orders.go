package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

const invoiceAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ" // no I/O to avoid confusion
const productShippingFeeThresholdKey = "product_shipping_fee_threshold"
const productShippingFeeBelowThresholdKey = "product_shipping_fee_below_threshold"

func randomInvoiceSuffix(n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = invoiceAlphabet[rand.Intn(len(invoiceAlphabet))]
	}
	return string(b)
}

// OrderItem represents one line in the cart.
type OrderItem struct {
	ProductID   int      `json:"product_id"`
	ProductName string   `json:"product_name"`
	VariantID   *int     `json:"variant_id,omitempty"`
	VariantName string   `json:"variant_name,omitempty"`
	Quantity    int      `json:"quantity"`
	UnitPrice   float64  `json:"unit_price"`
	ImageURLs   []string `json:"image_urls"`
	Note        string   `json:"note"`
	// CatalogImageURL is set server-side: variant image or first product gallery image (raw S3). Admin UI uses it when image_urls is empty.
	CatalogImageURL string `json:"catalog_image,omitempty"`
}

// POST /api/product-orders
// Idempotent via cart_session_id (UUID from localStorage).
func productShippingFeeForSubtotal(ctx context.Context, subtotal float64) (float64, error) {
	rows, err := config.DB.Query(ctx, `
		SELECT key, value FROM metadata
		WHERE key IN ($1, $2)`,
		productShippingFeeThresholdKey, productShippingFeeBelowThresholdKey)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	values := map[string]float64{}
	for rows.Next() {
		var key, raw string
		if err := rows.Scan(&key, &raw); err != nil {
			return 0, err
		}
		amount, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
		if err != nil || amount < 0 {
			amount = 0
		}
		values[key] = amount
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	threshold := values[productShippingFeeThresholdKey]
	fee := values[productShippingFeeBelowThresholdKey]
	if threshold <= 0 || fee <= 0 || subtotal >= threshold {
		return 0, nil
	}
	return math.Round(fee), nil
}

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
	for idx, it := range body.Items {
		var maxUploadImages int
		var productName string
		var unitPrice float64
		var imagesJSON []byte
		err := config.DB.QueryRow(context.Background(),
			`SELECT name,
				CASE
					WHEN discount_price IS NOT NULL
						AND (discount_from IS NULL OR discount_from <= NOW())
						AND (discount_to IS NULL OR discount_to >= NOW())
					THEN discount_price
					ELSE price
				END AS unit_price,
				COALESCE(max_upload_images, 15),
				COALESCE(images, '[]'::jsonb)
			FROM products
			WHERE id = $1 AND is_active = TRUE AND is_draft = FALSE`,
			it.ProductID).Scan(&productName, &unitPrice, &maxUploadImages, &imagesJSON)
		if err != nil {
			BadRequest(w, fmt.Sprintf("product %d not found", it.ProductID))
			return
		}

		var productImageURLs []string
		if json.Unmarshal(imagesJSON, &productImageURLs) != nil {
			productImageURLs = nil
		}
		firstProductImg := ""
		if len(productImageURLs) > 0 {
			firstProductImg = strings.TrimSpace(productImageURLs[0])
		}

		// If a variant is specified, validate it and use its effective price (discount if active).
		if it.VariantID != nil {
			var variantName string
			var variantPrice float64
			var variantImage *string
			variantErr := config.DB.QueryRow(context.Background(),
				`SELECT name,
					CASE
						WHEN discount_price IS NOT NULL
							AND (discount_from IS NULL OR discount_from <= NOW())
							AND (discount_to   IS NULL OR discount_to   >= NOW())
						THEN discount_price
						ELSE price
					END AS effective_price,
					image
				FROM product_variants WHERE id = $1 AND product_id = $2`,
				*it.VariantID, it.ProductID).Scan(&variantName, &variantPrice, &variantImage)
			if variantErr != nil {
				BadRequest(w, fmt.Sprintf("variant %d not found for product %d", *it.VariantID, it.ProductID))
				return
			}
			unitPrice = variantPrice
			body.Items[idx].VariantName = variantName
			if variantImage != nil && strings.TrimSpace(*variantImage) != "" {
				body.Items[idx].CatalogImageURL = strings.TrimSpace(*variantImage)
			} else {
				body.Items[idx].CatalogImageURL = firstProductImg
			}
		} else {
			body.Items[idx].CatalogImageURL = firstProductImg
		}

		if unitPrice < 0 {
			unitPrice = 0
		}
		if maxUploadImages < 1 {
			maxUploadImages = 15
		}
		if len(it.ImageURLs) > maxUploadImages {
			BadRequest(w, fmt.Sprintf("%s chỉ được upload tối đa %d ảnh", it.ProductName, maxUploadImages))
			return
		}
		body.Items[idx].ProductName = productName
		body.Items[idx].UnitPrice = math.Round(unitPrice)
	}

	var subtotal float64
	for _, it := range body.Items {
		subtotal += float64(it.Quantity) * it.UnitPrice
	}
	subtotal = math.Round(subtotal)
	shippingFee, err := productShippingFeeForSubtotal(context.Background(), subtotal)
	if err != nil {
		InternalError(w, err)
		return
	}
	total := math.Round(subtotal + shippingFee)
	shippingFee = math.Round(shippingFee)

	itemsJSON, err := json.Marshal(body.Items)
	if err != nil {
		InternalError(w, err)
		return
	}

	// Upsert: if same cart_session_id is submitted twice, update and return existing row.
	// Guard: only update if still pending (do not overwrite a paid order).
	row := config.DB.QueryRow(context.Background(), `
		INSERT INTO product_orders
			(cart_session_id, customer_name, customer_phone, customer_email,
			 customer_address, items, subtotal, shipping_fee, total_amount)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT (cart_session_id) DO UPDATE SET
			customer_name    = EXCLUDED.customer_name,
			customer_phone   = EXCLUDED.customer_phone,
			customer_email   = EXCLUDED.customer_email,
			customer_address = EXCLUDED.customer_address,
			items            = EXCLUDED.items,
			subtotal         = EXCLUDED.subtotal,
			shipping_fee     = EXCLUDED.shipping_fee,
			total_amount     = EXCLUDED.total_amount,
			updated_at       = NOW()
		WHERE product_orders.payment_status = 'pending'
		RETURNING id`,
		body.CartSessionID, body.CustomerName, body.CustomerPhone,
		nullStr(body.CustomerEmail), body.CustomerAddress,
		string(itemsJSON), subtotal, shippingFee, total,
	)
	var orderID int
	if err := row.Scan(&orderID); err != nil {
		// If scan fails, the order is already paid — fetch its id and return it as-is.
		fetchRow := config.DB.QueryRow(context.Background(),
			"SELECT id FROM product_orders WHERE cart_session_id = $1",
			body.CartSessionID)
		if err2 := fetchRow.Scan(&orderID); err2 != nil {
			InternalError(w, err)
			return
		}
		// Return existing paid order without further processing.
		Created(w, map[string]any{
			"success":      true,
			"order_id":     orderID,
			"already_paid": true,
		})
		return
	}

	// Set invoice_number: INXK{id}{5-char random suffix}.
	invoiceNumber := fmt.Sprintf("INXK%d%s", orderID, randomInvoiceSuffix(5))
	config.DB.Exec(context.Background(), //nolint
		"UPDATE product_orders SET invoice_number = $1 WHERE id = $2 AND invoice_number IS NULL",
		invoiceNumber, orderID)

	Created(w, map[string]any{
		"success":        true,
		"order_id":       orderID,
		"invoice_number": invoiceNumber,
		"shipping_fee":   shippingFee,
		"total_amount":   total,
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

// MoveTempImages moves all temp S3 images in items to the permanent paid/ prefix.
// Individual move errors are logged and the original URL is kept — order creation is never blocked.
func MoveTempImages(items []OrderItem, orderID int) []OrderItem {
	result := make([]OrderItem, len(items))
	for i, it := range items {
		moved := make([]string, len(it.ImageURLs))
		for j, url := range it.ImageURLs {
			newURL, err := config.MoveTempS3Image(url, orderID)
			if err != nil {
				log.Printf("warn: moveTempImages order %d: %v", orderID, err)
				moved[j] = url
			} else {
				moved[j] = newURL
			}
		}
		result[i] = it
		result[i].ImageURLs = moved
	}
	return result
}

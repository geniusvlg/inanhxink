package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/notify"
)

func sepayAPIKey() string    { return os.Getenv("SEPAY_API_KEY") }
func sepayAccountNo() string { return os.Getenv("SEPAY_ACCOUNT_NO") }
func sepayAccountName() string {
	return os.Getenv("SEPAY_ACCOUNT_NAME")
}
func sepayMerchantID() string { return os.Getenv("SEPAY_MERCHANT_ID") }
func sepayCheckoutSecret() string {
	if v := os.Getenv("SEPAY_SECRET_KEY"); v != "" {
		return v
	}
	return os.Getenv("SEPAY_CHECKOUT_SECRET") // legacy fallback
}
func sepayBank() string {
	if b := os.Getenv("SEPAY_BANK"); b != "" {
		return b
	}
	return "MBBank"
}

func sepayProductAccountNo() string {
	if acc := os.Getenv("SEPAY_PRODUCT_ACCOUNT_NO"); acc != "" {
		return acc
	}
	return sepayAccountNo()
}

func sepayProductAccountName() string {
	if name := os.Getenv("SEPAY_PRODUCT_ACCOUNT_NAME"); name != "" {
		return name
	}
	return sepayAccountName()
}

func sepayProductBank() string {
	if b := os.Getenv("SEPAY_PRODUCT_BANK"); b != "" {
		return b
	}
	return sepayBank()
}

func sepayCheckoutURL() string {
	if strings.HasPrefix(sepayCheckoutSecret(), "spsk_live_") {
		return "https://pay.sepay.vn/v1/checkout/init"
	}
	return "https://pay-sandbox.sepay.vn/v1/checkout/init"
}

var signedFieldOrder = []string{
	"order_amount", "merchant", "currency", "operation",
	"order_description", "order_invoice_number",
	"customer_id", "payment_method",
	"success_url", "error_url", "cancel_url",
}

func sepaySignFields(fields map[string]string, secret string) string {
	var parts []string
	for _, key := range signedFieldOrder {
		if val, ok := fields[key]; ok {
			parts = append(parts, key+"="+val)
		}
	}
	sigStr := strings.Join(parts, ",")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(sigStr))
	sig := base64.StdEncoding.EncodeToString(mac.Sum(nil))
	log.Printf("[sepay-sign] string=%q sig=%s", sigStr, sig)
	return sig
}

func publicBaseURL() string {
	if u := os.Getenv("PUBLIC_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	d := domain()
	if strings.HasPrefix(d, "localhost") || strings.HasPrefix(d, "127.") {
		return "https://inanhxink.com"
	}
	return "https://" + d
}

// POST /api/payments/product-checkout — signed SePay Checkout for a product_order.
func CreateProductCheckout(w http.ResponseWriter, r *http.Request) {
	merchantID := sepayMerchantID()
	secret := sepayCheckoutSecret()
	if merchantID == "" || secret == "" {
		JSON(w, 503, map[string]any{"success": false, "error": "SePay Checkout not configured"})
		return
	}

	var body struct {
		OrderID int `json:"orderId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == 0 {
		BadRequest(w, "orderId is required")
		return
	}

	var totalAmount float64
	var invoiceNumber string
	if err := config.DB.QueryRow(context.Background(),
		"SELECT total_amount, COALESCE(invoice_number, '') FROM product_orders WHERE id = $1 AND payment_status = 'pending'",
		body.OrderID).Scan(&totalAmount, &invoiceNumber); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found or already paid"})
		return
	}
	if invoiceNumber == "" {
		invoiceNumber = fmt.Sprintf("INXK%d%s", body.OrderID, randomInvoiceSuffix(5))
	}

	amount := int(math.Round(totalAmount))
	baseURL := publicBaseURL()

	fields := map[string]string{
		"merchant":             merchantID,
		"currency":             "VND",
		"order_amount":         strconv.Itoa(amount),
		"operation":            "PURCHASE",
		"order_description":    fmt.Sprintf("Don hang %s - inanhxink.com", invoiceNumber),
		"order_invoice_number": invoiceNumber,
		"success_url":          fmt.Sprintf("%s/checkout/result?status=success&orderId=%d", baseURL, body.OrderID),
		"error_url":            fmt.Sprintf("%s/checkout/result?status=error&orderId=%d", baseURL, body.OrderID),
		"cancel_url":           fmt.Sprintf("%s/checkout/result?status=cancel&orderId=%d", baseURL, body.OrderID),
	}
	sig := sepaySignFields(fields, secret)
	log.Printf("[sepay-product-checkout] fields=%v sig=%s", fields, sig)

	orderedFields := []map[string]string{
		{"name": "order_amount", "value": fields["order_amount"]},
		{"name": "merchant", "value": merchantID},
		{"name": "currency", "value": "VND"},
		{"name": "operation", "value": "PURCHASE"},
		{"name": "order_description", "value": fields["order_description"]},
		{"name": "order_invoice_number", "value": invoiceNumber},
		{"name": "success_url", "value": fields["success_url"]},
		{"name": "error_url", "value": fields["error_url"]},
		{"name": "cancel_url", "value": fields["cancel_url"]},
		{"name": "signature", "value": sig},
	}

	OK(w, map[string]any{
		"success":        true,
		"action_url":     sepayCheckoutURL(),
		"ordered_fields": orderedFields,
	})
}

// POST /api/payments/checkout — generates a signed SePay Checkout form payload.
// Returns the fields + action URL so the frontend can POST directly to SePay.
func CreateCheckout(w http.ResponseWriter, r *http.Request) {
	merchantID := sepayMerchantID()
	secret := sepayCheckoutSecret()
	if merchantID == "" || secret == "" {
		JSON(w, 503, map[string]any{"success": false, "error": "SePay Checkout not configured"})
		return
	}

	var body struct {
		OrderID int `json:"orderId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == 0 {
		BadRequest(w, "orderId is required")
		return
	}

	var totalAmount float64
	var qrName string
	if err := config.DB.QueryRow(context.Background(),
		"SELECT total_amount, qr_name FROM orders WHERE id = $1 AND payment_status = 'pending'",
		body.OrderID).Scan(&totalAmount, &qrName); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found or already paid"})
		return
	}

	amount := int(math.Round(totalAmount))
	invoiceNo := fmt.Sprintf("INXK%d%s", body.OrderID, qrName)
	baseURL := publicBaseURL()

	fields := map[string]string{
		"merchant":             merchantID,
		"currency":             "VND",
		"order_amount":         strconv.Itoa(amount),
		"operation":            "PURCHASE",
		"order_description":    fmt.Sprintf("Thanh toan don hang #%d - %s", body.OrderID, qrName),
		"order_invoice_number": invoiceNo,
		"success_url":          fmt.Sprintf("%s/order/%s?payment=success", baseURL, qrName),
		"error_url":            fmt.Sprintf("%s/order/%s?payment=error", baseURL, qrName),
		"cancel_url":           fmt.Sprintf("%s/order/%s?payment=cancel", baseURL, qrName),
	}
	fields["signature"] = sepaySignFields(fields, secret)

	OK(w, map[string]any{
		"success":    true,
		"action_url": sepayCheckoutURL(),
		"fields":     fields,
	})
}

// POST /api/payments
func CreatePayment(w http.ResponseWriter, r *http.Request) {
	var body struct {
		OrderID int `json:"orderId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrderID == 0 {
		BadRequest(w, "orderId is required")
		return
	}

	orderRow := config.DB.QueryRow(context.Background(),
		"SELECT id, total_amount, payment_status, qr_name FROM orders WHERE id = $1", body.OrderID)
	var orderID int
	var totalAmount float64
	var paymentStatus, qrName string
	if err := orderRow.Scan(&orderID, &totalAmount, &paymentStatus, &qrName); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found"})
		return
	}
	if paymentStatus == "paid" {
		BadRequest(w, "Order is already paid")
		return
	}

	// Return existing pending payment if any
	existRow := config.DB.QueryRow(context.Background(),
		"SELECT id, payment_qr_url FROM qr_transaction WHERE order_id = $1 AND status = 'pending'", orderID)
	var txID int
	var txQRURL string
	if err := existRow.Scan(&txID, &txQRURL); err == nil {
		paymentCode := fmt.Sprintf("INXK%d%s", orderID, qrName)
		OK(w, map[string]any{
			"success": true,
			"payment": map[string]any{
				"id":          txID,
				"qrUrl":       txQRURL,
				"amount":      totalAmount,
				"paymentCode": paymentCode,
				"accountNo":   sepayAccountNo(),
				"accountName": sepayAccountName(),
				"bank":        sepayBank(),
			},
		})
		return
	}

	amount := int(math.Round(totalAmount))
	paymentCode := fmt.Sprintf("INXK%d%s", orderID, qrName)
	qrURL := fmt.Sprintf(
		"https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%d&des=%s&template=compact",
		url.QueryEscape(sepayAccountNo()),
		url.QueryEscape(sepayBank()),
		amount,
		url.QueryEscape(paymentCode),
	)

	var newTxID int
	var newAmount float64
	if err := config.DB.QueryRow(context.Background(), `
		INSERT INTO qr_transaction (order_id, amount, status, payment_qr_url)
		VALUES ($1, $2, 'pending', $3) RETURNING id, amount`,
		orderID, amount, qrURL).Scan(&newTxID, &newAmount); err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{
		"success": true,
		"payment": map[string]any{
			"id":          newTxID,
			"qrUrl":       qrURL,
			"amount":      newAmount,
			"paymentCode": paymentCode,
			"accountNo":   sepayAccountNo(),
			"accountName": sepayAccountName(),
			"bank":        sepayBank(),
		},
	})
}

// webhookPayload is the common shape of a SePay bank-transfer notification.
type webhookPayload struct {
	ID             int     `json:"id"`
	Content        string  `json:"content"`
	TransferType   string  `json:"transferType"`
	TransferAmount float64 `json:"transferAmount"`
	ReferenceCode  string  `json:"referenceCode"`
}

func decodeWebhookPayload(w http.ResponseWriter, r *http.Request) (*webhookPayload, bool) {
	authHeader := r.Header.Get("Authorization")
	expectedKey := "Apikey " + sepayAPIKey()
	if sepayAPIKey() == "" || authHeader != expectedKey {
		JSON(w, 401, map[string]any{"success": false, "error": "Unauthorized"})
		return nil, false
	}
	var p webhookPayload
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		BadRequest(w, "Invalid payload")
		return nil, false
	}
	return &p, true
}

// POST /api/payments/webhook/qr — SePay notification for QR-template orders (INXK bank account).
func QRPaymentWebhook(w http.ResponseWriter, r *http.Request) {
	payload, ok := decodeWebhookPayload(w, r)
	if !ok {
		return
	}
	if payload.TransferType != "in" {
		OK(w, map[string]any{"success": true, "message": "Ignored: not an incoming transfer"})
		return
	}

	webhookRaw, _ := json.Marshal(payload)

	re := regexp.MustCompile(`(?i)INXK(\d+)`)
	match := re.FindStringSubmatch(payload.Content)
	if match == nil {
		OK(w, map[string]any{"success": true, "message": "No matching order code found in content"})
		return
	}
	orderID, _ := strconv.Atoi(match[1])

	txRow := config.DB.QueryRow(context.Background(),
		"SELECT id, amount FROM qr_transaction WHERE order_id = $1 AND status = 'pending'", orderID)
	var txID int
	var requiredAmount float64
	if err := txRow.Scan(&txID, &requiredAmount); err != nil {
		OK(w, map[string]any{"success": true, "message": "No pending payment found"})
		return
	}
	if payload.TransferAmount < requiredAmount {
		OK(w, map[string]any{"success": true, "message": "Underpayment ignored"})
		return
	}

	tx, err := config.DB.Begin(context.Background())
	if err != nil {
		InternalError(w, err)
		return
	}
	defer tx.Rollback(context.Background()) //nolint

	var qrName, content, templateType string
	var templateID int
	var templateDataRaw []byte
	var keychainPurchased bool
	var customerName, customerEmail, customerPhone string
	var orderTotal float64
	orderRow := tx.QueryRow(context.Background(),
		`SELECT qr_name, content, template_id, template_type, template_data, keychain_purchased,
			COALESCE(customer_name::text, ''), COALESCE(customer_email::text, ''), COALESCE(customer_phone::text, ''),
			total_amount
		 FROM orders WHERE id = $1 FOR UPDATE`, orderID)
	if err := orderRow.Scan(&qrName, &content, &templateID, &templateType, &templateDataRaw, &keychainPurchased,
		&customerName, &customerEmail, &customerPhone, &orderTotal); err != nil {
		InternalError(w, err)
		return
	}

	if _, err := tx.Exec(context.Background(), "SELECT pg_advisory_xact_lock(hashtext($1))", qrName); err != nil {
		InternalError(w, err)
		return
	}

	var existingPaidOrderID int
	if err := tx.QueryRow(context.Background(), `
		SELECT id FROM orders
		WHERE qr_name = $1 AND payment_status = 'paid' AND id <> $2
		LIMIT 1`, qrName, orderID).Scan(&existingPaidOrderID); err == nil {
		tx.Exec(context.Background(), `
			UPDATE qr_transaction SET status = 'failed', sepay_transaction_id = $1,
				updated_at = NOW(), webhook_payload = $2, reference_code = $3
			WHERE id = $4`, payload.ID, string(webhookRaw), payload.ReferenceCode, txID) //nolint
		tx.Exec(context.Background(), `
			UPDATE orders SET payment_status = 'cancelled', updated_at = NOW()
			WHERE id = $1`, orderID) //nolint
		if err := tx.Commit(context.Background()); err != nil {
			InternalError(w, err)
			return
		}
		OK(w, map[string]any{"success": true, "message": "Ignored: QR name already activated by another paid order"})
		return
	}

	if _, err := tx.Exec(context.Background(), `
		UPDATE qr_transaction SET status = 'paid', sepay_transaction_id = $1,
			paid_at = NOW(), updated_at = NOW(), webhook_payload = $2, reference_code = $3
		WHERE id = $4`, payload.ID, string(webhookRaw), payload.ReferenceCode, txID); err != nil {
		InternalError(w, err)
		return
	}
	keychainDeliveryStatus := (*string)(nil)
	if keychainPurchased {
		s := "processing"
		keychainDeliveryStatus = &s
	}
	if _, err := tx.Exec(context.Background(),
		"UPDATE orders SET payment_status = 'paid', keychain_delivery_status = $1, updated_at = NOW() WHERE id = $2",
		keychainDeliveryStatus, orderID); err != nil {
		InternalError(w, err)
		return
	}

	if _, err := tx.Exec(context.Background(), `
		UPDATE orders SET payment_status = 'cancelled', updated_at = NOW()
		WHERE qr_name = $1 AND id <> $2 AND payment_status <> 'paid'`, qrName, orderID); err != nil {
		InternalError(w, err)
		return
	}

	// Release in-memory reservation so the name is not seen as "reserved" anymore.
	releaseReservation(qrName)
	if _, err := tx.Exec(context.Background(), `
		UPDATE qr_transaction SET status = 'failed', updated_at = NOW()
		WHERE status = 'pending'
		  AND order_id IN (
			SELECT id FROM orders WHERE qr_name = $1 AND id <> $2 AND payment_status = 'cancelled'
		  )`, qrName, orderID); err != nil {
		InternalError(w, err)
		return
	}

	fullUrl := qrName + "." + domain()
	if templateType == "" {
		templateType = "galaxy"
	}
	var qrID int
	tx.QueryRow(context.Background(), `
		INSERT INTO qr_codes (qr_name, full_url, content, template_id, template_type, template_data)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (qr_name) DO UPDATE
			SET full_url=EXCLUDED.full_url, content=EXCLUDED.content,
				template_id=EXCLUDED.template_id, template_type=EXCLUDED.template_type,
				template_data=EXCLUDED.template_data, updated_at=NOW()
		RETURNING id`,
		qrName, fullUrl, content, templateID, templateType, string(templateDataRaw),
	).Scan(&qrID) //nolint
	tx.Exec(context.Background(), "UPDATE orders SET qr_code_id = $1 WHERE id = $2", qrID, orderID) //nolint

	if err := tx.Commit(context.Background()); err != nil {
		InternalError(w, err)
		return
	}
	go migrateQRUploads(qrName, orderID, templateDataRaw)
	notify.QROrderPaid(notify.QROrderPaidDetail{
		OrderID:       orderID,
		QRName:        qrName,
		TemplateType:  templateType,
		CustomerName:  customerName,
		CustomerEmail: customerEmail,
		CustomerPhone: customerPhone,
		Total:         orderTotal,
		Domain:        domain(),
	})
	OK(w, map[string]any{"success": true, "message": "Payment confirmed"})
}

// POST /api/payments/webhook/product — SePay notification for product orders (product bank account).
func ProductPaymentWebhook(w http.ResponseWriter, r *http.Request) {
	payload, ok := decodeWebhookPayload(w, r)
	if !ok {
		return
	}
	log.Printf("[product-webhook] received sepay_id=%d amount=%.0f transfer_type=%s content=%q", payload.ID, payload.TransferAmount, payload.TransferType, payload.Content)
	if payload.TransferType != "in" {
		OK(w, map[string]any{"success": true, "message": "Ignored: not an incoming transfer"})
		return
	}

	webhookRaw, _ := json.Marshal(payload)

	var productOrderID int
	if err := config.DB.QueryRow(context.Background(), `
		SELECT id FROM product_orders
		WHERE payment_status = 'pending'
		  AND invoice_number IS NOT NULL
		  AND $1 ILIKE '%' || invoice_number || '%'
		LIMIT 1`, payload.Content).Scan(&productOrderID); err != nil {
		log.Printf("[product-webhook] no matching pending product order: sepay_id=%d content=%q err=%v", payload.ID, payload.Content, err)
		OK(w, map[string]any{"success": true, "message": "No matching product order found"})
		return
	}
	log.Printf("[product-webhook] matched product_order_id=%d sepay_id=%d", productOrderID, payload.ID)

	handleProductOrderWebhook(w, strconv.Itoa(productOrderID), payload.TransferAmount, payload.ID, payload.ReferenceCode, string(webhookRaw))
}

// POST /api/payments/webhook/pay2s — temporary Pay2S callback logger for payload discovery.
func Pay2SWebhookLogger(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		InternalError(w, err)
		return
	}

	log.Printf("[pay2s-webhook] method=%s path=%s remote=%s", r.Method, r.URL.Path, r.RemoteAddr)
	log.Printf("[pay2s-webhook] query=%s", r.URL.RawQuery)
	log.Printf("[pay2s-webhook] headers=%v", r.Header)
	log.Printf("[pay2s-webhook] body=%s", string(raw))
	OK(w, map[string]any{"success": true})
}

func handleProductOrderWebhook(w http.ResponseWriter, orderIDStr string, amount float64, sepayID int, referenceCode string, webhookJSON string) {
	orderID, _ := strconv.Atoi(orderIDStr)
	if orderID == 0 {
		OK(w, map[string]any{"success": true, "message": "Invalid SHOP order id"})
		return
	}

	dbtx, err := config.DB.Begin(context.Background())
	if err != nil {
		log.Printf("[product-webhook] begin tx failed: order_id=%d sepay_id=%d err=%v", orderID, sepayID, err)
		InternalError(w, fmt.Errorf("begin product webhook transaction: %w", err))
		return
	}
	defer dbtx.Rollback(context.Background()) //nolint

	ctx := context.Background()
	var itemsJSON string
	var paymentStatus string
	var requiredAmount float64
	var subtotal, shippingFee float64
	var invoiceNumber, custName, custPhone, custEmail, custAddr string
	if err := dbtx.QueryRow(ctx, `
		SELECT items::text, payment_status, total_amount,
			COALESCE(subtotal, 0)::float8, COALESCE(shipping_fee, 0)::float8,
			COALESCE(invoice_number::text, ''),
			COALESCE(customer_name::text, ''),
			COALESCE(customer_phone::text, ''),
			COALESCE(customer_email::text, ''),
			COALESCE(customer_address::text, '')
		FROM product_orders WHERE id = $1 FOR UPDATE`, orderID).
		Scan(&itemsJSON, &paymentStatus, &requiredAmount, &subtotal, &shippingFee,
			&invoiceNumber, &custName, &custPhone, &custEmail, &custAddr); err != nil {
		log.Printf("[product-webhook] lock/select product order failed: order_id=%d sepay_id=%d err=%v", orderID, sepayID, err)
		OK(w, map[string]any{"success": true, "message": "No pending product order found"})
		return
	}
	if paymentStatus != "pending" {
		log.Printf("[product-webhook] order not pending: order_id=%d status=%s", orderID, paymentStatus)
		OK(w, map[string]any{"success": true, "message": "Order already processed"})
		return
	}
	if amount < requiredAmount {
		log.Printf("[product-webhook] underpayment ignored: order_id=%d sepay_id=%d paid=%.0f required=%.0f", orderID, sepayID, amount, requiredAmount)
		OK(w, map[string]any{"success": true, "message": "Underpayment ignored"})
		return
	}

	var dupCheck int
	if err := dbtx.QueryRow(ctx,
		"SELECT id FROM product_transaction WHERE sepay_transaction_id = $1", sepayID).Scan(&dupCheck); err == nil {
		log.Printf("[product-webhook] duplicate webhook ignored: order_id=%d sepay_id=%d existing_transaction_id=%d", orderID, sepayID, dupCheck)
		OK(w, map[string]any{"success": true, "message": "Duplicate webhook ignored"})
		return
	}

	orderPaidTag, err := dbtx.Exec(ctx,
		"UPDATE product_orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1 AND payment_status = 'pending'",
		orderID)
	if err != nil {
		log.Printf("[product-webhook] update product_orders failed: order_id=%d sepay_id=%d err=%v", orderID, sepayID, err)
		InternalError(w, fmt.Errorf("mark product order paid: %w", err))
		return
	}
	if orderPaidTag.RowsAffected() == 0 {
		log.Printf("[product-webhook] order already paid (race): order_id=%d", orderID)
		OK(w, map[string]any{"success": true, "message": "Order already processed"})
		return
	}

	// Normal checkout flow creates a pending transaction when the QR is shown.
	// Update that row first; only insert a paid row if no pending row exists.
	updateTag, err := dbtx.Exec(ctx, `
		UPDATE product_transaction
		SET status = 'paid', sepay_transaction_id = $1, webhook_payload = $2,
			reference_code = $3, paid_at = NOW(), updated_at = NOW()
		WHERE product_order_id = $4 AND status = 'pending' AND sepay_transaction_id IS NULL`,
		sepayID, webhookJSON, referenceCode, orderID)
	if err != nil {
		log.Printf("[product-webhook] update pending product_transaction failed: order_id=%d sepay_id=%d err=%v payload=%s", orderID, sepayID, err, webhookJSON)
		InternalError(w, fmt.Errorf("update pending product transaction: %w", err))
		return
	}
	if updateTag.RowsAffected() == 0 {
		log.Printf("[product-webhook] no pending product_transaction row; inserting paid fallback: order_id=%d sepay_id=%d", orderID, sepayID)
		if _, err := dbtx.Exec(ctx, `
			INSERT INTO product_transaction (product_order_id, amount, status, sepay_transaction_id, reference_code, webhook_payload, paid_at)
			VALUES ($1, $2, 'paid', $3, $4, $5, NOW())
			ON CONFLICT (sepay_transaction_id) WHERE sepay_transaction_id IS NOT NULL DO NOTHING`,
			orderID, amount, sepayID, referenceCode, webhookJSON); err != nil {
			log.Printf("[product-webhook] insert product_transaction failed: order_id=%d sepay_id=%d amount=%.0f err=%v payload=%s", orderID, sepayID, amount, err, webhookJSON)
			InternalError(w, fmt.Errorf("insert paid product transaction: %w", err))
			return
		}
	}

	var orderItems []OrderItem
	if err := json.Unmarshal([]byte(itemsJSON), &orderItems); err != nil {
		log.Printf("[product-webhook] unmarshal items order_id=%d: %v", orderID, err)
		InternalError(w, fmt.Errorf("parse order items: %w", err))
		return
	}
	if err := IncrementProductSoldCounts(ctx, dbtx, orderItems); err != nil {
		log.Printf("[product-webhook] increment sold_count order_id=%d: %v", orderID, err)
		InternalError(w, err)
		return
	}

	if err := dbtx.Commit(ctx); err != nil {
		log.Printf("[product-webhook] commit failed: order_id=%d sepay_id=%d amount=%.0f required=%.0f err=%v payload=%s", orderID, sepayID, amount, requiredAmount, err, webhookJSON)
		InternalError(w, fmt.Errorf("commit product webhook transaction: %w", err))
		return
	}
	log.Printf("[product-orders] order %d paid — sepay_id=%d amount=%.0f", orderID, sepayID, amount)

	notify.ProductOrderPaid(notify.ProductOrderPaidDetail{
		OrderID:         orderID,
		InvoiceNumber:   invoiceNumber,
		CustomerName:    custName,
		CustomerPhone:   custPhone,
		CustomerEmail:   custEmail,
		CustomerAddress: custAddr,
		Subtotal:        subtotal,
		ShippingFee:     shippingFee,
		Total:           requiredAmount,
		ItemsLines:      FormatProductOrderItemsVN(orderItems),
	})

	// Move temp S3 images → product-orders/paid/{orderID}/ now that payment is confirmed.
	go func() {
		// Fetch current items from DB (they may have been updated by admin).
		var itemsJSON string
		if err := config.DB.QueryRow(context.Background(),
			"SELECT items::text FROM product_orders WHERE id = $1", orderID).Scan(&itemsJSON); err != nil {
			log.Printf("[product-orders] moveTempImages fetch items order %d: %v", orderID, err)
			return
		}
		var items []OrderItem
		if err := json.Unmarshal([]byte(itemsJSON), &items); err != nil {
			log.Printf("[product-orders] moveTempImages unmarshal order %d: %v", orderID, err)
			return
		}
		movedItems := MoveTempImages(items, orderID)
		if movedJSON, err := json.Marshal(movedItems); err == nil {
			config.DB.Exec(context.Background(), //nolint
				"UPDATE product_orders SET items = $1 WHERE id = $2",
				string(movedJSON), orderID)
		}
	}()

	OK(w, map[string]any{"success": true, "message": "Product order payment confirmed"})
}

// migrateQRUploads moves confirmed images from uploads/temp/{qrName}/ to
// uploads/{qrName}/, then updates both orders and qr_codes with permanent URLs.
// Runs in a goroutine — errors are logged but never surface to the client.
func migrateQRUploads(qrName string, orderID int, templateDataRaw []byte) {
	rewritten, copiedKeys, err := config.RewriteTemplateDataURLs(
		templateDataRaw,
		"uploads/temp/"+qrName+"/",
		"uploads/"+qrName,
	)
	if err != nil {
		log.Printf("[payments] migrateQRUploads %s: rewrite error: %v", qrName, err)
		return
	}
	if len(copiedKeys) == 0 {
		return
	}

	ctx := context.Background()
	if _, err := config.DB.Exec(ctx,
		"UPDATE orders SET template_data = $1 WHERE id = $2",
		string(rewritten), orderID); err != nil {
		log.Printf("[payments] migrateQRUploads %s: update orders failed: %v", qrName, err)
	}
	if _, err := config.DB.Exec(ctx,
		"UPDATE qr_codes SET template_data = $1 WHERE qr_name = $2",
		string(rewritten), qrName); err != nil {
		log.Printf("[payments] migrateQRUploads %s: update qr_codes failed: %v", qrName, err)
	}

	config.DeleteS3Objects(copiedKeys)
	log.Printf("[payments] migrateQRUploads %s: migrated %d object(s)", qrName, len(copiedKeys))
}

// GET /api/payments/order/:orderId
func GetPaymentByOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, order_id, amount, status, payment_qr_url, paid_at, created_at
		FROM qr_transaction WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, orderID)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err != nil || row == nil {
		JSON(w, 404, map[string]any{"success": false, "error": "No payment found for this order"})
		return
	}
	OK(w, map[string]any{"success": true, "payment": row})
}

// GET /api/payments/qr/:qrName
func GetPaymentByQR(w http.ResponseWriter, r *http.Request) {
	qrName := chi.URLParam(r, "qrName")

	orderRow := config.DB.QueryRow(context.Background(), `
		SELECT id, total_amount, payment_status, qr_name
		FROM orders WHERE qr_name = $1 ORDER BY created_at DESC LIMIT 1`, qrName)
	var orderID int
	var totalAmount float64
	var paymentStatus, orderQRName string
	if err := orderRow.Scan(&orderID, &totalAmount, &paymentStatus, &orderQRName); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found"})
		return
	}
	fullUrl := orderQRName + "." + domain()
	paymentCode := fmt.Sprintf("INXK%d%s", orderID, orderQRName)

	txRows, err := config.DB.Query(context.Background(), `
		SELECT id, amount, status, payment_qr_url, paid_at, created_at
		FROM qr_transaction WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, orderID)
	if err != nil {
		InternalError(w, err)
		return
	}
	tx, _ := CollectOne(txRows)

	var paymentResp any
	if tx != nil {
		paymentResp = map[string]any{
			"id":          tx["id"],
			"qrUrl":       tx["payment_qr_url"],
			"amount":      tx["amount"],
			"paymentCode": paymentCode,
			"status":      tx["status"],
			"accountNo":   sepayAccountNo(),
			"accountName": sepayAccountName(),
			"bank":        sepayBank(),
		}
	}

	OK(w, map[string]any{
		"success": true,
		"order": map[string]any{
			"id": orderID, "qrName": orderQRName, "fullUrl": fullUrl,
			"totalAmount": totalAmount, "paymentStatus": paymentStatus,
		},
		"payment": paymentResp,
	})
}

// GET /api/payments/product/:orderId
func GetProductPayment(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")

	row := config.DB.QueryRow(context.Background(), `
		SELECT id, COALESCE(invoice_number, ''), total_amount, payment_status
		FROM product_orders WHERE id = $1`, orderID)
	var id int
	var invoiceNumber, paymentStatus string
	var totalAmount float64
	if err := row.Scan(&id, &invoiceNumber, &totalAmount, &paymentStatus); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Product order not found"})
		return
	}
	if invoiceNumber == "" {
		invoiceNumber = fmt.Sprintf("INXK%d%s", id, randomInvoiceSuffix(5))
	}

	amount := int(math.Round(totalAmount))
	qrURL := fmt.Sprintf(
		"https://qr.sepay.vn/img?acc=%s&bank=%s&amount=%d&des=%s&template=compact",
		url.QueryEscape(sepayProductAccountNo()),
		url.QueryEscape(sepayProductBank()),
		amount,
		url.QueryEscape(invoiceNumber),
	)

	txStatus := paymentStatus

	// Reuse an existing pending product_transaction row so polling this GET
	// endpoint does not create duplicate pending rows for the same order.
	if paymentStatus == "pending" {
		var existingQRURL string
		err := config.DB.QueryRow(context.Background(), `
			SELECT COALESCE(payment_qr_url, '')
			FROM product_transaction
			WHERE product_order_id = $1 AND status = 'pending'
			ORDER BY created_at DESC
			LIMIT 1`,
			id).Scan(&existingQRURL)
		if err == nil {
			txStatus = "pending"
			if existingQRURL != "" {
				qrURL = existingQRURL
			}
		} else if err == pgx.ErrNoRows {
			if _, err := config.DB.Exec(context.Background(), `
				INSERT INTO product_transaction (product_order_id, amount, status, payment_qr_url)
				VALUES ($1, $2, 'pending', $3)`,
				id, amount, qrURL); err != nil {
				InternalError(w, fmt.Errorf("create pending product transaction: %w", err))
				return
			}
			txStatus = "pending"
		} else {
			InternalError(w, fmt.Errorf("find pending product transaction: %w", err))
			return
		}
	}

	// Return existing transaction status if present.
	if txStatus != "pending" {
		_ = config.DB.QueryRow(context.Background(),
			"SELECT status FROM product_transaction WHERE product_order_id = $1 ORDER BY created_at DESC LIMIT 1", id,
		).Scan(&txStatus)
		if txStatus == "" {
			txStatus = paymentStatus
		}
	}

	OK(w, map[string]any{
		"success": true,
		"order": map[string]any{
			"id":            id,
			"invoiceNumber": invoiceNumber,
			"totalAmount":   totalAmount,
			"paymentStatus": paymentStatus,
		},
		"payment": map[string]any{
			"qrUrl":       qrURL,
			"amount":      amount,
			"paymentCode": invoiceNumber,
			"status":      txStatus,
			"accountNo":   sepayProductAccountNo(),
			"accountName": sepayProductAccountName(),
			"bank":        sepayProductBank(),
		},
	})
}

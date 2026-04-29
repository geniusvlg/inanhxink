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

	"inanhxink/backend-golang/internal/config"
)

func sepayAPIKey() string       { return os.Getenv("SEPAY_API_KEY") }
func sepayAccountNo() string    { return os.Getenv("SEPAY_ACCOUNT_NO") }
func sepayMerchantID() string   { return os.Getenv("SEPAY_MERCHANT_ID") }
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
		invoiceNumber = fmt.Sprintf("SHOP%d", body.OrderID)
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
		"success":       true,
		"action_url":    sepayCheckoutURL(),
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
		"SELECT id, payment_qr_url FROM transactions WHERE order_id = $1 AND status = 'pending'", orderID)
	var txID int
	var txQRURL string
	if err := existRow.Scan(&txID, &txQRURL); err == nil {
		paymentCode := fmt.Sprintf("INXK%d%s", orderID, qrName)
		OK(w, map[string]any{
			"success": true,
			"payment": map[string]any{"id": txID, "qrUrl": txQRURL, "amount": totalAmount, "paymentCode": paymentCode},
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
		INSERT INTO transactions (order_id, amount, status, payment_qr_url)
		VALUES ($1, $2, 'pending', $3) RETURNING id, amount`,
		orderID, amount, qrURL).Scan(&newTxID, &newAmount); err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{
		"success": true,
		"payment": map[string]any{"id": newTxID, "qrUrl": qrURL, "amount": newAmount, "paymentCode": paymentCode},
	})
}

// POST /api/payments/webhook — Sepay payment confirmation webhook
func PaymentWebhook(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	expectedKey := "Apikey " + sepayAPIKey()
	if sepayAPIKey() == "" || authHeader != expectedKey {
		JSON(w, 401, map[string]any{"success": false, "error": "Unauthorized"})
		return
	}

	var payload struct {
		ID             int     `json:"id"`
		Content        string  `json:"content"`
		TransferType   string  `json:"transferType"`
		TransferAmount float64 `json:"transferAmount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		BadRequest(w, "Invalid payload")
		return
	}

	if payload.TransferType != "in" {
		OK(w, map[string]any{"success": true, "message": "Ignored: not an incoming transfer"})
		return
	}

	// Check for product order (SHOP prefix) first.
	shopRe := regexp.MustCompile(`(?i)SHOP(\d+)`)
	if shopMatch := shopRe.FindStringSubmatch(payload.Content); shopMatch != nil {
		handleProductOrderWebhook(w, shopMatch[1], payload.TransferAmount, payload.ID, string(func() []byte { b, _ := json.Marshal(payload); return b }()))
		return
	}

	re := regexp.MustCompile(`(?i)INXK(\d+)`)
	match := re.FindStringSubmatch(payload.Content)
	if match == nil {
		OK(w, map[string]any{"success": true, "message": "No matching order code found in content"})
		return
	}
	orderID, _ := strconv.Atoi(match[1])

	txRow := config.DB.QueryRow(context.Background(),
		"SELECT id, amount FROM transactions WHERE order_id = $1 AND status = 'pending'", orderID)
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

	webhookJSON, _ := json.Marshal(payload)

	var qrName, content, templateType string
	var templateID int
	var templateDataRaw []byte
	var keychainPurchased bool
	orderRow := tx.QueryRow(context.Background(),
		"SELECT qr_name, content, template_id, template_type, template_data, keychain_purchased FROM orders WHERE id = $1 FOR UPDATE", orderID)
	if err := orderRow.Scan(&qrName, &content, &templateID, &templateType, &templateDataRaw, &keychainPurchased); err != nil {
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
			UPDATE transactions SET status = 'failed', sepay_transaction_id = $1,
				updated_at = NOW(), webhook_payload = $2
			WHERE id = $3`, payload.ID, string(webhookJSON), txID) //nolint
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
		UPDATE transactions SET status = 'paid', sepay_transaction_id = $1,
			paid_at = NOW(), updated_at = NOW(), webhook_payload = $2
		WHERE id = $3`, payload.ID, string(webhookJSON), txID); err != nil {
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
		UPDATE transactions SET status = 'failed', updated_at = NOW()
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
	go prunePaidOrderUploads(qrName, templateDataRaw)
	OK(w, map[string]any{"success": true, "message": "Payment confirmed"})
}

// ── SePay Checkout IPN ────────────────────────────────────────────────────────

// POST /api/payments/ipn
// Receives ORDER_PAID notifications from SePay Checkout.
// Currently logs the full raw payload for inspection; processing TBD.
func SepayIPN(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		InternalError(w, err)
		return
	}
	log.Printf("[ipn] headers: %v", r.Header)
	log.Printf("[ipn] body: %s", string(raw))
	OK(w, map[string]any{"success": true})
}

func handleProductOrderWebhook(w http.ResponseWriter, orderIDStr string, amount float64, sepayID int, webhookJSON string) {
	orderID, _ := strconv.Atoi(orderIDStr)
	if orderID == 0 {
		OK(w, map[string]any{"success": true, "message": "Invalid SHOP order id"})
		return
	}

	var requiredAmount float64
	if err := config.DB.QueryRow(context.Background(),
		"SELECT total_amount FROM product_orders WHERE id = $1 AND payment_status = 'pending'",
		orderID).Scan(&requiredAmount); err != nil {
		OK(w, map[string]any{"success": true, "message": "No pending product order found"})
		return
	}
	if amount < requiredAmount {
		OK(w, map[string]any{"success": true, "message": "Underpayment ignored"})
		return
	}

	if _, err := config.DB.Exec(context.Background(),
		"UPDATE product_orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1 AND payment_status = 'pending'",
		orderID); err != nil {
		InternalError(w, err)
		return
	}
	log.Printf("[product-orders] SHOP%d paid — sepay_id=%d amount=%.0f webhook=%s", orderID, sepayID, amount, webhookJSON)
	OK(w, map[string]any{"success": true, "message": "Product order payment confirmed"})
}

func prunePaidOrderUploads(qrName string, templateDataRaw []byte) {
	keep := map[string]bool{}
	collectS3KeysFromJSON(templateDataRaw, keep)
	if err := config.PruneS3Folder("uploads/"+qrName, keep); err != nil {
		log.Printf("[payments] prune uploads/%s failed: %v", qrName, err)
	}
}

func collectS3KeysFromJSON(raw []byte, keep map[string]bool) {
	if len(raw) == 0 {
		return
	}
	var data any
	if err := json.Unmarshal(raw, &data); err != nil {
		return
	}
	collectS3Keys(data, keep)
}

func collectS3Keys(value any, keep map[string]bool) {
	switch v := value.(type) {
	case string:
		if key, ok := config.ExtractKeyFromURL(v); ok {
			keep[key] = true
		}
	case []any:
		for _, item := range v {
			collectS3Keys(item, keep)
		}
	case map[string]any:
		for _, item := range v {
			collectS3Keys(item, keep)
		}
	}
}

// GET /api/payments/order/:orderId
func GetPaymentByOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "orderId")
	rows, err := config.DB.Query(context.Background(), `
		SELECT id, order_id, amount, status, payment_qr_url, paid_at, created_at
		FROM transactions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, orderID)
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
		FROM transactions WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1`, orderID)
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

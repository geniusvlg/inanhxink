package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
)

func sepayAPIKey() string    { return os.Getenv("SEPAY_API_KEY") }
func sepayAccountNo() string { return os.Getenv("SEPAY_ACCOUNT_NO") }
func sepayBank() string {
	if b := os.Getenv("SEPAY_BANK"); b != "" {
		return b
	}
	return "MBBank"
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

	if _, err := tx.Exec(context.Background(), `
		UPDATE transactions SET status = 'paid', sepay_transaction_id = $1,
			paid_at = NOW(), updated_at = NOW(), webhook_payload = $2
		WHERE id = $3`, payload.ID, string(webhookJSON), txID); err != nil {
		InternalError(w, err)
		return
	}
	if _, err := tx.Exec(context.Background(),
		"UPDATE orders SET payment_status = 'paid', updated_at = NOW() WHERE id = $1", orderID); err != nil {
		InternalError(w, err)
		return
	}

	// Activate QR code
	var qrName, content, templateType string
	var templateID int
	var templateDataRaw []byte
	orderRow := tx.QueryRow(context.Background(),
		"SELECT qr_name, content, template_id, template_type, template_data FROM orders WHERE id = $1", orderID)
	if err := orderRow.Scan(&qrName, &content, &templateID, &templateType, &templateDataRaw); err == nil {
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
	}

	if err := tx.Commit(context.Background()); err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{"success": true, "message": "Payment confirmed"})
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

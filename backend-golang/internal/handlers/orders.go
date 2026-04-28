package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/config"
)

var socialMusicRe = regexp.MustCompile(`(?i)tiktok\.com|instagram\.com`)

var validTemplateTypes = map[string]bool{
	"galaxy": true, "loveletter": true, "letterinspace": true, "lovedays": true, "birthday": true, "specialgift": true,
}

var templateFolderMap = map[string]string{
	"letterinspace": "galaxy",
	"loveletter":    "loveletter",
	"galaxy":        "galaxy",
	"lovedays":      "lovedays",
	"birthday":      "birthday",
	"specialgift":   "specialgift",
}

func domain() string {
	if d := os.Getenv("DOMAIN"); d != "" {
		return d
	}
	return "inanhxink.com"
}

// POST /api/orders/check-qr-name
func CheckQRName(w http.ResponseWriter, r *http.Request) {
	var body struct {
		QRName string `json:"qrName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.QRName == "" {
		BadRequest(w, "QR name is required")
		return
	}
	qrName := strings.ToLower(body.QRName)
	if matched, _ := regexp.MatchString(`^[a-z0-9_-]+$`, qrName); !matched {
		BadRequest(w, "QR name must be lowercase letters, numbers, dashes, or underscores only")
		return
	}

	// Permanently taken (paid order exists)
	row := config.DB.QueryRow(context.Background(), "SELECT id FROM qr_codes WHERE qr_name = $1", qrName)
	var id int
	if err := row.Scan(&id); err == nil {
		OK(w, map[string]any{"success": false, "available": false, "message": "QR name already taken"})
		return
	}

	// Locked by another user who just submitted an order (5-min window)
	if isReserved(qrName) {
		OK(w, map[string]any{"success": false, "available": false, "message": "QR name is temporarily locked, please try another name or try again in 5 minutes"})
		return
	}

	OK(w, map[string]any{
		"success":   true,
		"available": true,
		"message":   "QR name is available",
		"fullUrl":   qrName + "." + domain(),
	})
}

// POST /api/orders
func CreateOrder(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		BadRequest(w, "Invalid JSON body")
		return
	}

	qrName, _ := body["qrName"].(string)
	templateID := body["templateId"]
	if qrName == "" || templateID == nil {
		BadRequest(w, "qrName and templateId are required")
		return
	}

	qrNameLowerEarly := strings.ToLower(qrName)

	// Try to acquire the in-memory lock. If another user submitted an order for
	// this name first, reject immediately with a clear message.
	if !acquireReservation(qrNameLowerEarly) {
		JSON(w, 409, map[string]any{"success": false, "error": "Tên QR này vừa được đặt bởi người khác. Vui lòng chọn tên khác."})
		return
	}

	templateType, _ := body["templateType"].(string)
	resolvedType := ""
	if validTemplateTypes[templateType] {
		resolvedType = templateType
	} else {
		resolvedType = templateFolderMap[templateType]
	}
	if resolvedType == "" {
		BadRequest(w, fmt.Sprintf("Unknown template type. Supported: galaxy, loveletter, letterinspace, lovedays, birthday, specialgift"))
		return
	}

	// Birthday: finalText max 50 chars
	if resolvedType == "birthday" {
		if ft, ok := body["birthdayFinalText"].(string); ok && len(ft) > 50 {
			BadRequest(w, "Lời chúc không được quá 50 ký tự")
			return
		}
	}

	content, _ := body["content"].(string)
	imageUrls, _ := body["imageUrls"].([]any)
	musicUrl, _ := body["musicUrl"].(string)
	musicLink, _ := body["musicLink"].(string)
	musicAdded, _ := body["musicAdded"].(bool)
	keychainPurchased, _ := body["keychainPurchased"].(bool)
	tipAmount := toFloat(body["tipAmount"])
	voucherCode, _ := body["voucherCode"].(string)
	customerName, _ := body["customerName"].(string)
	customerEmail, _ := body["customerEmail"].(string)
	customerPhone, _ := body["customerPhone"].(string)

	// Build template_data
	templateData := map[string]any{"content": content}
	if templateType == "letterinspace" || templateType == "galaxy" || templateType == "specialgift" {
		templateData["texts"] = splitNonEmptyLines(content)
	}
	switch templateType {
	case "loveletter":
		templateData["title"] = strOrDefault(body, "letterTitle", "Love Letter")
		templateData["sender"] = strOrDefault(body, "letterSender", "")
		templateData["receiver"] = strOrDefault(body, "letterReceiver", "")
		if hint := strings.TrimSpace(strOrDefault(body, "letterHint", "")); hint != "" {
			templateData["hint"] = hint
		}
		if signoff := strings.TrimSpace(strOrDefault(body, "letterSignoff", "")); signoff != "" {
			templateData["signoff"] = signoff
		}
	case "lovedays":
		templateData["date"] = strOrDefault(body, "loveDaysDate", "")
		templateData["nameFrom"] = strOrDefault(body, "loveDaysNameFrom", "")
		templateData["nameTo"] = strOrDefault(body, "loveDaysNameTo", "")
		templateData["avatarFrom"] = strOrDefault(body, "loveDaysAvatarFrom", "")
		templateData["avatarTo"] = strOrDefault(body, "loveDaysAvatarTo", "")
		templateData["message"] = strOrDefault(body, "loveDaysMessage", "")
		templateData["theme"] = strOrDefault(body, "loveDaysTheme", "soft")
		if imgs, ok := body["loveDaysGalleryImages"].([]any); ok {
			templateData["popupImages"] = imgs
		} else {
			templateData["popupImages"] = []any{}
		}
		if tl, ok := body["loveDaysTimeline"].([]any); ok {
			var filtered []map[string]any
			for _, item := range tl {
				if m, ok := item.(map[string]any); ok {
					d, _ := m["date"].(string)
					t, _ := m["text"].(string)
					if strings.TrimSpace(d) != "" || strings.TrimSpace(t) != "" {
						filtered = append(filtered, map[string]any{"date": strings.TrimSpace(d), "text": strings.TrimSpace(t)})
					}
				}
			}
			templateData["timeline"] = filtered
		}
		if popup, ok := templateData["popupImages"].([]any); ok && len(popup) == 0 && len(imageUrls) > 2 {
			templateData["popupImages"] = imageUrls[2:]
		}
	case "specialgift":
		templateData["date"] = strOrDefault(body, "specialGiftDate", "")
		templateData["startDate"] = strOrDefault(body, "specialGiftDate", "")
		templateData["boyName"] = strOrDefault(body, "specialGiftNameLeft", "")
		templateData["girlName"] = strOrDefault(body, "specialGiftNameRight", "")
		templateData["dayLabel"] = strOrDefault(body, "specialGiftDayLabel", "ngày yêu nhau")
		templateData["titleMessage"] = strOrDefault(body, "specialGiftTitle", "Happy Valentine's Day 💘")
		templateData["boyImage"] = strOrDefault(body, "specialGiftAvatarLeft", "")
		templateData["girlImage"] = strOrDefault(body, "specialGiftAvatarRight", "")
		if imgs, ok := body["specialGiftGalleryImages"].([]any); ok {
			templateData["imageUrls"] = imgs
		} else {
			templateData["imageUrls"] = []any{}
		}
	case "birthday":
		templateData["backgroundText"] = strOrDefault(body, "birthdayBackgroundText", "I LOVE YOU")
		templateData["backgroundColor"] = strOrDefault(body, "birthdayBackgroundColor", "#ffa3e0")
		if v, ok := body["birthdayTextColor"]; ok {
			templateData["textColor"] = v
		} else {
			templateData["textColor"] = map[string]int{"r": 179, "g": 204, "b": 255}
		}
		if v, ok := body["birthdayHeartColor"]; ok {
			templateData["heartColor"] = v
		} else {
			templateData["heartColor"] = map[string]int{"r": 255, "g": 105, "b": 180}
		}
		templateData["messages"] = []string{
			strOrDefault(body, "birthdayTitle", "Happy Birthday"),
			strOrDefault(body, "birthdayName", ""),
			strOrDefault(body, "birthdayAge", ""),
			birthdayDateMessage(body),
		}
		templateData["finalText"] = strOrDefault(body, "birthdayFinalText", "")
	}
	if len(imageUrls) > 0 && templateType != "specialgift" {
		templateData["imageUrls"] = imageUrls
	}

	// Download music from social URLs
	resolvedMusicUrl := musicUrl
	if resolvedMusicUrl == "" {
		resolvedMusicUrl = musicLink
	}
	if resolvedMusicUrl != "" && musicAdded && socialMusicRe.MatchString(resolvedMusicUrl) {
		var err error
		resolvedMusicUrl, err = downloadAndUploadMusic(resolvedMusicUrl, strings.ToLower(qrName))
		if err != nil {
			JSON(w, 400, map[string]any{"success": false, "error": err.Error()})
			return
		}
	}
	if resolvedMusicUrl != "" {
		templateData["musicUrl"] = resolvedMusicUrl
	}

	// Get template price
	var templatePrice float64
	if err := config.DB.QueryRow(context.Background(),
		"SELECT price FROM templates WHERE id = $1", templateID).Scan(&templatePrice); err != nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Template not found"})
		return
	}

	// Get music/keychain prices from metadata
	metaRows, err := config.DB.Query(context.Background(),
		"SELECT key, value FROM metadata WHERE key IN ('music_price', 'keychain_price')")
	if err != nil {
		InternalError(w, err)
		return
	}
	defer metaRows.Close()
	meta := map[string]float64{}
	for metaRows.Next() {
		var k, v string
		metaRows.Scan(&k, &v) //nolint
		var n float64
		fmt.Sscanf(v, "%f", &n)
		meta[k] = n
	}
	musicPrice := 0.0
	if musicAdded {
		if p, ok := meta["music_price"]; ok {
			musicPrice = p
		} else {
			musicPrice = 10000
		}
	}
	keychainPrice := 0.0
	if keychainPurchased {
		if p, ok := meta["keychain_price"]; ok {
			keychainPrice = p
		} else {
			keychainPrice = 35000
		}
	}

	// Voucher
	var voucherDiscount float64
	var discountType string
	if voucherCode != "" {
		vRows, err := config.DB.Query(context.Background(), `
			SELECT discount_value, discount_type FROM vouchers
			WHERE UPPER(code) = UPPER($1) AND is_active = true
			AND (expires_at IS NULL OR expires_at > NOW())
			AND (max_uses IS NULL OR used_count < max_uses)`, voucherCode)
		if err == nil {
			v, _ := CollectOne(vRows)
			if v != nil {
				voucherDiscount = toFloat(v["discount_value"])
				discountType, _ = v["discount_type"].(string)
				config.DB.Exec(context.Background(), //nolint
					"UPDATE vouchers SET used_count = used_count + 1 WHERE UPPER(code) = UPPER($1)", voucherCode)
			}
		}
	}

	subtotal := templatePrice + keychainPrice + musicPrice + tipAmount
	total := subtotal
	if voucherDiscount > 0 {
		if discountType == "percentage" {
			total = subtotal * (1 - voucherDiscount/100)
		} else {
			total = math.Max(0, subtotal-voucherDiscount)
		}
	}
	discount := math.Round(subtotal - total)
	subtotal = math.Round(subtotal)
	total = math.Round(total)

	qrNameLower := qrNameLowerEarly
	fullUrl := qrNameLower + "." + domain()

	tdJSON, _ := json.Marshal(templateData)

	var orderID int
	err = config.DB.QueryRow(context.Background(), `
		INSERT INTO orders (
			customer_name, customer_email, customer_phone,
			template_id, template_type, template_data, qr_name, content, music_link, music_added,
			keychain_purchased, keychain_price, tip_amount, voucher_code, voucher_discount,
			subtotal, total_amount, payment_status, keychain_delivery_status
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
		RETURNING id`,
		nullStr(customerName), nullStr(customerEmail), nullStr(customerPhone),
		templateID, resolvedType, string(tdJSON),
		qrNameLower, content, nullStr(resolvedMusicUrl),
		musicAdded, keychainPurchased, keychainPrice,
		tipAmount, nullStr(voucherCode), discount, subtotal, total, "pending", keychainDelivery(keychainPurchased),
	).Scan(&orderID)
	if err != nil {
		InternalError(w, err)
		return
	}

	// Return full order row
	orderRows, err := config.DB.Query(context.Background(), "SELECT * FROM orders WHERE id = $1", orderID)
	if err != nil {
		InternalError(w, err)
		return
	}
	order, _ := CollectOne(orderRows)

	OK(w, map[string]any{
		"success": true,
		"order":   order,
		"qrCode": map[string]any{
			"qrName":       qrNameLower,
			"fullUrl":      fullUrl,
			"templateType": resolvedType,
		},
	})
}

// GET /api/orders/:id
func GetOrder(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := config.DB.Query(context.Background(), `
		SELECT o.*, t.name AS template_name, t.image_url AS template_image
		FROM orders o LEFT JOIN templates t ON o.template_id = t.id
		WHERE o.id = $1`, id)
	if err != nil {
		InternalError(w, err)
		return
	}
	row, err := CollectOne(rows)
	if err == pgx.ErrNoRows || row == nil {
		JSON(w, 404, map[string]any{"success": false, "error": "Order not found"})
		return
	}
	if err != nil {
		InternalError(w, err)
		return
	}
	OK(w, map[string]any{"success": true, "order": row})
}

// helpers

func toFloat(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case int:
		return float64(x)
	case int64:
		return float64(x)
	case string:
		var f float64
		fmt.Sscanf(x, "%f", &f)
		return f
	}
	return 0
}

func strOrDefault(m map[string]any, key, def string) string {
	if v, ok := m[key].(string); ok && v != "" {
		return v
	}
	return def
}

func splitNonEmptyLines(content string) []string {
	lines := strings.Split(content, "\n")
	texts := make([]string, 0, len(lines))
	for _, line := range lines {
		if t := strings.TrimSpace(line); t != "" {
			texts = append(texts, t)
		}
	}
	return texts
}

func birthdayDateMessage(m map[string]any) string {
	date := strOrDefault(m, "birthdayDate", "")
	if date == "" {
		return ""
	}
	return fmt.Sprintf("%s.%d", date, time.Now().Year())
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

// keychainDelivery returns "pending" if a keychain was purchased, nil otherwise.
func keychainDelivery(purchased bool) any {
	if purchased {
		return "pending"
	}
	return nil
}

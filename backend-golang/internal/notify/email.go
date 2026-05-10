// Package notify sends optional admin alerts (e.g. new orders) via SMTP.
// Settings come from metadata keys notify_* (Admin → Cấu hình).
package notify

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"os"
	"strings"
	"unicode"
)

func domainFromEnv() string {
	if d := os.Getenv("DOMAIN"); d != "" {
		return d
	}
	return "inanhxink.com"
}

// QROrderPaid emails admins when a QR/template order is marked paid (webhook or admin).
func QROrderPaid(d QROrderPaidDetail) {
	if strings.TrimSpace(d.Domain) == "" {
		d.Domain = domainFromEnv()
	}
	subject := fmt.Sprintf("[inanhxink] Đơn QR #%d — đã thanh toán", d.OrderID)
	body := buildQREmailBody(d)
	go func() {
		s := loadMailSettings(context.Background())
		if !s.ok() {
			return
		}
		if err := sendWithSettings(s, subject, body); err != nil {
			log.Printf("notify: QROrderPaid email: %v", err)
		}
	}()
}

// ProductOrderPaid emails admins when a product order is marked paid (webhook or admin).
func ProductOrderPaid(d ProductOrderPaidDetail) {
	subject := fmt.Sprintf("[inanhxink] Đơn sản phẩm #%d — đã thanh toán", d.OrderID)
	body := buildProductEmailBody(d)
	go func() {
		s := loadMailSettings(context.Background())
		if !s.ok() {
			return
		}
		if err := sendWithSettings(s, subject, body); err != nil {
			log.Printf("notify: ProductOrderPaid email: %v", err)
		}
	}()
}

func sendWithSettings(s mailSettings, subject, body string) error {
	addr := fmt.Sprintf("%s:%s", s.Host, s.Port)
	var auth smtp.Auth
	if s.User != "" || s.Pass != "" {
		auth = smtp.PlainAuth("", s.User, s.Pass, s.Host)
	}

	subjHdr := subject
	if needsMIMEEncode(subject) {
		subjHdr = mime.QEncoding.Encode("UTF-8", subject)
	}

	var msg bytes.Buffer
	fmt.Fprintf(&msg, "From: %s\r\n", s.From)
	fmt.Fprintf(&msg, "To: %s\r\n", strings.Join(s.Recipients, ", "))
	fmt.Fprintf(&msg, "Subject: %s\r\n", subjHdr)
	fmt.Fprintf(&msg, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&msg, "Content-Type: text/plain; charset=UTF-8\r\n")
	fmt.Fprintf(&msg, "\r\n")
	msg.WriteString(body)

	return smtp.SendMail(addr, auth, s.From, s.Recipients, msg.Bytes())
}

func needsMIMEEncode(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || !unicode.IsPrint(r) {
			return true
		}
	}
	return false
}

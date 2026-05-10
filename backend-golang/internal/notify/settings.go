package notify

import (
	"context"
	"strings"

	"inanhxink/backend-golang/internal/config"
)

// Metadata keys — set in Admin → Cấu hình (/admin/config).
const (
	MetaAdminEmail = "notify_admin_email"
	MetaSMTPHost   = "notify_smtp_host"
	MetaSMTPPort   = "notify_smtp_port"
	MetaSMTPFrom   = "notify_smtp_from"
	MetaSMTPUser   = "notify_smtp_user"
	MetaSMTPPass   = "notify_smtp_password"
)

// MetaKeyPrefix is stripped from public GET /api/metadata responses.
const MetaKeyPrefix = "notify_"

// NormalizeSMTPPass removes spaces so Gmail app passwords match what smtp.gmail.com expects.
func NormalizeSMTPPass(s string) string {
	return strings.ReplaceAll(strings.TrimSpace(s), " ", "")
}

type mailSettings struct {
	Recipients []string
	Host       string
	Port       string
	From       string
	User       string
	Pass       string
}

// loadMailSettings reads notify_* from metadata only (no env fallback).
func loadMailSettings(ctx context.Context) mailSettings {
	meta := map[string]string{}
	rows, err := config.DB.Query(ctx, `
		SELECT key, value FROM metadata
		WHERE key IN ($1,$2,$3,$4,$5,$6)`,
		MetaAdminEmail, MetaSMTPHost, MetaSMTPPort, MetaSMTPFrom, MetaSMTPUser, MetaSMTPPass)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, v string
			rows.Scan(&k, &v) //nolint
			meta[k] = v
		}
	}

	rawRecipients := strings.TrimSpace(meta[MetaAdminEmail])
	var recipients []string
	for _, part := range strings.Split(rawRecipients, ",") {
		if e := strings.TrimSpace(part); e != "" {
			recipients = append(recipients, e)
		}
	}

	port := strings.TrimSpace(meta[MetaSMTPPort])
	if port == "" {
		port = "587"
	}

	from := strings.TrimSpace(meta[MetaSMTPFrom])
	user := strings.TrimSpace(meta[MetaSMTPUser])
	if user == "" {
		// Gmail and many providers expect the mailbox address as AUTH user; matches "From".
		user = from
	}

	return mailSettings{
		Recipients: recipients,
		Host:       strings.TrimSpace(meta[MetaSMTPHost]),
		Port:       port,
		From:       from,
		User:       user,
		Pass:       NormalizeSMTPPass(meta[MetaSMTPPass]),
	}
}

func (s mailSettings) ok() bool {
	return len(s.Recipients) > 0 && strings.TrimSpace(s.Host) != "" && strings.TrimSpace(s.From) != ""
}

package admin

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

var qrNamePattern = regexp.MustCompile(`^[a-z0-9_-]+$`)

// qrNameS3Prefixes lists every folder that can hold objects for a QR name:
// permanent uploads plus the pre-payment staging area. Trailing slashes keep
// sibling names (anhyeuem vs anhyeuem2) out of the sweep.
func qrNameS3Prefixes(qrName string) []string {
	return []string{
		"uploads/" + qrName + "/",
		"uploads/temp/" + qrName + "/",
	}
}

// DELETE /api/admin/qr-names/{qrName}
//
// Frees a QR name so another customer can buy it: drops the qr_codes row (the
// UNIQUE gate behind availability checks), stamps qr_name_released_at on the
// orders holding the name, and deletes the name's S3 objects. Orders survive for
// accounting — they simply no longer own the name.
func ReleaseQRName(w http.ResponseWriter, r *http.Request) {
	qrName := strings.ToLower(strings.TrimSpace(chi.URLParam(r, "qrName")))
	if qrName == "" || !qrNamePattern.MatchString(qrName) {
		handlers.BadRequest(w, "Tên QR không hợp lệ")
		return
	}

	ctx := context.Background()
	tx, err := config.DB.Begin(ctx)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	defer tx.Rollback(ctx) //nolint

	// Same lock ActivatePaidQROrder takes, so a payment landing right now either
	// finishes before the release or sees the released rows.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtext($1))", qrName); err != nil {
		handlers.InternalError(w, err)
		return
	}

	var ordersReleased int
	if err := tx.QueryRow(ctx, `
		WITH released AS (
			UPDATE orders
			SET qr_name_released_at = NOW(), qr_code_id = NULL, updated_at = NOW()
			WHERE qr_name = $1 AND qr_name_released_at IS NULL
			RETURNING id
		)
		SELECT COUNT(*) FROM released`, qrName).Scan(&ordersReleased); err != nil {
		handlers.InternalError(w, err)
		return
	}

	// qr_codes must go last: orders.qr_code_id references it with NO ACTION.
	tag, err := tx.Exec(ctx, "DELETE FROM qr_codes WHERE qr_name = $1", qrName)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	qrCodeDeleted := tag.RowsAffected() > 0

	if ordersReleased == 0 && !qrCodeDeleted {
		handlers.NotFound(w)
		return
	}

	if err := tx.Commit(ctx); err != nil {
		handlers.InternalError(w, err)
		return
	}

	// Without this the name stays locked for up to the 5-minute reservation TTL.
	handlers.ReleaseQRNameReservation(qrName)

	s3Deleted := 0
	for _, prefix := range qrNameS3Prefixes(qrName) {
		n, err := config.DeleteS3Prefix(prefix)
		s3Deleted += n
		if err != nil {
			log.Printf("[admin] ReleaseQRName %s: S3 cleanup %s: %v", qrName, prefix, err)
		}
	}

	log.Printf("[admin] ReleaseQRName %s: %d order(s) released, qr_codes deleted=%t, %d S3 object(s) removed",
		qrName, ordersReleased, qrCodeDeleted, s3Deleted)

	handlers.OK(w, map[string]any{
		"success":        true,
		"qrName":         qrName,
		"ordersReleased": ordersReleased,
		"qrCodeDeleted":  qrCodeDeleted,
		"s3Deleted":      s3Deleted,
		"message": fmt.Sprintf(
			"Đã thu hồi tên QR \"%s\": %d đơn được giải phóng, %d tệp ảnh đã xoá. Tên này có thể được đặt lại.",
			qrName, ordersReleased, s3Deleted),
	})
}

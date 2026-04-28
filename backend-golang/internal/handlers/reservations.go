package handlers

import (
	"sync"
	"time"
)

// reservationTTL is how long a QR name stays locked after an order is submitted.
// If the user doesn't complete payment within this window the lock expires and
// another user can claim the name.
const reservationTTL = 5 * time.Minute

type qrReservation struct {
	expiresAt time.Time
}

var qrReservations sync.Map // key: qrName (string) → value: qrReservation

// isReserved reports whether qrName is currently locked by someone.
func isReserved(qrName string) bool {
	v, ok := qrReservations.Load(qrName)
	if !ok {
		return false
	}
	r := v.(qrReservation)
	if time.Now().After(r.expiresAt) {
		qrReservations.Delete(qrName)
		return false
	}
	return true
}

// acquireReservation tries to lock qrName for reservationTTL.
// Returns false if another user already holds an active lock.
func acquireReservation(qrName string) bool {
	newR := qrReservation{expiresAt: time.Now().Add(reservationTTL)}
	actual, loaded := qrReservations.LoadOrStore(qrName, newR)
	if !loaded {
		return true // we just stored it — we own it
	}
	existing := actual.(qrReservation)
	if time.Now().After(existing.expiresAt) {
		// Expired entry; overwrite and claim it.
		qrReservations.Store(qrName, newR)
		return true
	}
	return false // active lock held by someone else
}

// releaseReservation removes the lock for qrName (called on payment success).
func releaseReservation(qrName string) {
	qrReservations.Delete(qrName)
}

// PruneExpiredReservations removes stale entries; call periodically from main.
func PruneExpiredReservations() {
	now := time.Now()
	qrReservations.Range(func(k, v any) bool {
		if r, ok := v.(qrReservation); ok && now.After(r.expiresAt) {
			qrReservations.Delete(k)
		}
		return true
	})
}

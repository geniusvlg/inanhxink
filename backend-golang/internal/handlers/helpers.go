// Package handlers contains HTTP handler functions for all API routes.
// Helpers (JSON response, query helpers) live here.
package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
)

// JSON writes v as a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("json encode error: %v", err)
	}
}

func OK(w http.ResponseWriter, v any)      { JSON(w, http.StatusOK, v) }
func Created(w http.ResponseWriter, v any) { JSON(w, http.StatusCreated, v) }

func BadRequest(w http.ResponseWriter, msg string) {
	JSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": msg})
}
func NotFound(w http.ResponseWriter) {
	JSON(w, http.StatusNotFound, map[string]any{"success": false, "error": "Not found"})
}
func Unauthorized(w http.ResponseWriter, msg string) {
	JSON(w, http.StatusUnauthorized, map[string]any{"success": false, "error": msg})
}
func Forbidden(w http.ResponseWriter) {
	JSON(w, http.StatusForbidden, map[string]any{"success": false, "error": "Forbidden"})
}
func InternalError(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	JSON(w, http.StatusInternalServerError, map[string]any{"success": false, "error": err.Error()})
}

// CollectRows collects all rows into a slice of maps. Callers should close rows after.
func CollectRows(rows pgx.Rows) ([]map[string]any, error) {
	return pgx.CollectRows(rows, pgx.RowToMap)
}

// CollectOne collects a single row into a map. Returns nil if no rows.
func CollectOne(rows pgx.Rows) (map[string]any, error) {
	return pgx.CollectOneRow(rows, pgx.RowToMap)
}

// IntParam parses a string as an int, defaulting to def on error.
func IntParam(s string, def int) int {
	var v int
	if err := json.Unmarshal([]byte(s), &v); err == nil {
		return v
	}
	return def
}

// Clamp returns val clamped to [min, max].
func Clamp(val, min, max int) int {
	if val < min {
		return min
	}
	if val > max {
		return max
	}
	return val
}

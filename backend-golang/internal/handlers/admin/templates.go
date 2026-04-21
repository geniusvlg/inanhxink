package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// GET /api/admin/templates
func ListTemplates(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(), "SELECT * FROM templates ORDER BY id ASC")
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	templates, err := handlers.CollectRows(rows)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "templates": templates})
}

// GET /api/admin/templates/:id
func GetTemplate(w http.ResponseWriter, r *http.Request) {
	rows, err := config.DB.Query(context.Background(),
		"SELECT * FROM templates WHERE id = $1", chi.URLParam(r, "id"))
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "template": row})
}

// POST /api/admin/templates
func CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name         string  `json:"name"`
		Description  *string `json:"description"`
		ImageURL     *string `json:"image_url"`
		Price        float64 `json:"price"`
		TemplateType string  `json:"template_type"`
		IsActive     *bool   `json:"is_active"`
		DemoURL      *string `json:"demo_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}
	if body.Name == "" || body.Price == 0 || body.TemplateType == "" {
		handlers.BadRequest(w, "name, price, template_type required")
		return
	}
	isActive := true
	if body.IsActive != nil {
		isActive = *body.IsActive
	}

	rows, err := config.DB.Query(context.Background(), `
		INSERT INTO templates (name, description, image_url, price, template_type, is_active, demo_url)
		VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
		body.Name, body.Description, body.ImageURL, body.Price, body.TemplateType, isActive, body.DemoURL)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, _ := handlers.CollectOne(rows)
	handlers.Created(w, map[string]any{"success": true, "template": row})
}

// PUT /api/admin/templates/:id
func UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var fields map[string]any
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil {
		handlers.BadRequest(w, "Invalid JSON")
		return
	}

	allowed := []string{"name", "description", "image_url", "price", "template_type", "is_active", "demo_url"}
	setClauses := []string{}
	values := []any{}
	i := 1
	for _, key := range allowed {
		if v, ok := fields[key]; ok {
			setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, i))
			values = append(values, v)
			i++
		}
	}
	if len(setClauses) == 0 {
		handlers.BadRequest(w, "No valid fields to update")
		return
	}
	values = append(values, id)

	rows, err := config.DB.Query(context.Background(),
		fmt.Sprintf("UPDATE templates SET %s WHERE id = $%d RETURNING *",
			joinClauses(setClauses), len(values)),
		values...)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	row, err := handlers.CollectOne(rows)
	if err != nil || row == nil {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "template": row})
}

// DELETE /api/admin/templates/:id — soft-delete (sets is_active=false)
func DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	result, err := config.DB.Exec(context.Background(),
		"UPDATE templates SET is_active = false WHERE id = $1", id)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if result.RowsAffected() == 0 {
		handlers.NotFound(w)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "message": "Template deactivated"})
}

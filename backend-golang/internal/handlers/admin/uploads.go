package admin

import (
	"encoding/json"
	"net/http"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

// DELETE /api/admin/uploads — best-effort removal of S3 objects by URL.
func DeleteUploads(w http.ResponseWriter, r *http.Request) {
	var body struct {
		URLs []string `json:"urls"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || len(body.URLs) == 0 {
		handlers.BadRequest(w, "urls (non-empty array) required")
		return
	}

	type result struct {
		URL     string `json:"url"`
		Deleted bool   `json:"deleted"`
		Error   string `json:"error,omitempty"`
	}
	var results []result
	for _, url := range body.URLs {
		deleted, err := config.DeleteFromS3(url)
		r := result{URL: url, Deleted: deleted}
		if err != nil {
			r.Error = err.Error()
		}
		results = append(results, r)
	}
	handlers.OK(w, map[string]any{"success": true, "results": results})
}

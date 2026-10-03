package admin

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"inanhxink/backend-golang/internal/config"
	"inanhxink/backend-golang/internal/handlers"
)

const maxProductVideoBytes = 100 * 1024 * 1024

// productVideoProgress holds the conversion percent for the single backend
// process. It is cleared when that conversion returns.
var productVideoProgress sync.Map

var productVideoMIMEs = map[string]string{
	"video/mp4":       ".mp4",
	"video/webm":      ".webm",
	"video/quicktime": ".mov",
}

type productVideoSignRequest struct {
	ContentType string `json:"contentType"`
	Size        int64  `json:"size"`
	Filename    string `json:"filename"`
}

type productVideoJob struct {
	ID             int     `json:"id"`
	Status         string  `json:"status"`
	OutputURL      *string `json:"outputUrl"`
	Error          *string `json:"error"`
	ApplyOnSuccess bool    `json:"applyOnSuccess"`
	Progress       int     `json:"progress"`
}

// PresignProductVideo stores an upload job and returns a short-lived PUT URL.
// The browser uploads the original file directly to VNG. Conversion starts
// only after the browser calls StartProductVideoJob.
func PresignProductVideo(w http.ResponseWriter, r *http.Request) {
	productID, productType, ok := loadProductVideoTarget(w, r)
	if !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	var body productVideoSignRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handlers.BadRequest(w, "Không đọc được yêu cầu tải video")
		return
	}
	if body.Size <= 0 || body.Size > maxProductVideoBytes {
		handlers.JSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"success": false,
			"error":   "Video quá lớn. Kích thước tối đa là 100MB.",
		})
		return
	}
	contentType, ext, valid := productVideoFormat(body.ContentType, body.Filename)
	if !valid {
		handlers.BadRequest(w, "Định dạng video không được hỗ trợ. Hãy dùng MP4, WebM hoặc video quay bằng iPhone.")
		return
	}

	stale, err := cancelReplaceableVideoJobs(r.Context(), productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	deleteVideoObjects(stale)

	token := make([]byte, 8)
	if _, err := rand.Read(token); err != nil {
		handlers.InternalError(w, err)
		return
	}
	key := fmt.Sprintf(
		"products/%s/product-%d/video/source/%d-%s%s",
		safeProductType(productType),
		productID,
		time.Now().UnixMilli(),
		hex.EncodeToString(token),
		ext,
	)
	signed, err := config.PresignPutObject(r.Context(), key, contentType)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}

	var jobID int
	if err := config.DB.QueryRow(r.Context(), `
		INSERT INTO product_video_job (product_id, status, source_url)
		VALUES ($1, 'uploading', $2)
		RETURNING id`,
		productID, signed.PublicURL).Scan(&jobID); err != nil {
		handlers.InternalError(w, err)
		return
	}

	handlers.OK(w, map[string]any{
		"success":   true,
		"jobId":     jobID,
		"uploadUrl": signed.URL,
		"publicUrl": signed.PublicURL,
		"headers":   signed.Headers,
	})
}

// StartProductVideoJob begins conversion. The admin form calls this only when
// the product is saved, after the browser has finished the direct upload.
func StartProductVideoJob(w http.ResponseWriter, r *http.Request) {
	productID, jobID, ok := productVideoIDs(w, r)
	if !ok {
		return
	}
	tag, err := config.DB.Exec(r.Context(), `
		UPDATE product_video_job
		SET status = 'processing', updated_at = NOW()
		WHERE id = $1 AND product_id = $2 AND status = 'uploading'`,
		jobID, productID)
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		handlers.BadRequest(w, "Video này không còn chờ xử lý")
		return
	}
	go processProductVideoJob(jobID)
	handlers.OK(w, map[string]any{"success": true, "jobId": jobID, "status": "processing"})
}

// GetProductVideoJob returns one job so the admin form can poll it.
func GetProductVideoJob(w http.ResponseWriter, r *http.Request) {
	productID, jobID, ok := productVideoIDs(w, r)
	if !ok {
		return
	}
	job, err := findProductVideoJob(r.Context(), productID, jobID)
	if err == pgx.ErrNoRows {
		handlers.NotFound(w)
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "job": job})
}

// LatestProductVideoJob returns the newest job for a product, if one exists.
func LatestProductVideoJob(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || productID <= 0 {
		handlers.BadRequest(w, "Sản phẩm không hợp lệ")
		return
	}
	job, err := findLatestProductVideoJob(r.Context(), productID)
	if err == pgx.ErrNoRows {
		handlers.OK(w, map[string]any{"success": true, "job": nil})
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	handlers.OK(w, map[string]any{"success": true, "job": job})
}

// CommitProductVideoJob marks a saved upload to replace the product video.
// If the original is still waiting, saving also starts conversion.
func CommitProductVideoJob(w http.ResponseWriter, r *http.Request) {
	productID, jobID, ok := productVideoIDs(w, r)
	if !ok {
		return
	}
	var status, previous string
	var output *string
	err := config.DB.QueryRow(r.Context(), `
		UPDATE product_video_job AS job
		SET apply_on_success = TRUE,
		    status = CASE WHEN job.status = 'uploading' THEN 'processing' ELSE job.status END,
		    updated_at = NOW()
		FROM (
			SELECT id, status
			FROM product_video_job
			WHERE id = $1 AND product_id = $2
		) AS previous
		WHERE job.id = previous.id
		  AND job.product_id = $2
		  AND job.status IN ('uploading', 'processing', 'ready')
		RETURNING job.status, job.output_url, previous.status`,
		jobID, productID).Scan(&status, &output, &previous)
	if err == pgx.ErrNoRows {
		handlers.BadRequest(w, "Video này không còn được xử lý")
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	if previous == "uploading" {
		go processProductVideoJob(jobID)
	}
	if status == "ready" && output != nil && *output != "" {
		if err := applyProductVideo(r.Context(), productID, *output); err != nil {
			handlers.InternalError(w, err)
			return
		}
	}
	handlers.OK(w, map[string]any{"success": true, "status": status})
}

// CancelProductVideoJob drops an upload that the admin did not keep.
func CancelProductVideoJob(w http.ResponseWriter, r *http.Request) {
	productID, jobID, ok := productVideoIDs(w, r)
	if !ok {
		return
	}
	var source, output *string
	err := config.DB.QueryRow(r.Context(), `
		UPDATE product_video_job
		SET status = 'cancelled', updated_at = NOW()
		WHERE id = $1 AND product_id = $2 AND status IN ('uploading', 'processing', 'ready')
		RETURNING source_url, output_url`,
		jobID, productID).Scan(&source, &output)
	if err == pgx.ErrNoRows {
		handlers.OK(w, map[string]any{"success": true})
		return
	}
	if err != nil {
		handlers.InternalError(w, err)
		return
	}
	current := currentProductVideoURL(r.Context(), productID)
	deleteVideoObjectsExcept(current, source, output)
	handlers.OK(w, map[string]any{"success": true})
}

// FailInterruptedProductVideoJobs marks jobs left behind by a server restart.
func FailInterruptedProductVideoJobs() {
	ctx := context.Background()
	rows, err := config.DB.Query(ctx, `
		UPDATE product_video_job
		SET status = 'failed',
		    error = 'Máy chủ khởi động lại khi video đang được xử lý.',
		    updated_at = NOW()
		WHERE status IN ('uploading', 'processing')
		RETURNING product_id, source_url, output_url`)
	if err != nil {
		log.Printf("[product-video] skip interrupted job cleanup: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var productID int
		var source, output *string
		if err := rows.Scan(&productID, &source, &output); err != nil {
			log.Printf("[product-video] interrupted job scan: %v", err)
			continue
		}
		current := currentProductVideoURL(ctx, productID)
		deleteVideoObjectsExcept(current, source, output)
	}
}

func processProductVideoJob(jobID int) {
	defer clearProductVideoProgress(jobID)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	var productID int
	var source string
	err := config.DB.QueryRow(ctx, `
		SELECT product_id, source_url
		FROM product_video_job
		WHERE id = $1 AND status = 'processing'`,
		jobID).Scan(&productID, &source)
	if err != nil {
		log.Printf("[product-video] job %d was not processing: %v", jobID, err)
		return
	}

	var productType string
	if err := config.DB.QueryRow(ctx, `SELECT type FROM products WHERE id = $1`, productID).Scan(&productType); err != nil {
		failProductVideoJob(jobID, source, "Không tìm thấy sản phẩm")
		return
	}

	tmpDir, err := os.MkdirTemp("", "product-video-")
	if err != nil {
		failProductVideoJob(jobID, source, "Không xử lý được video")
		return
	}
	defer os.RemoveAll(tmpDir)

	ext := strings.ToLower(filepath.Ext(strings.Split(source, "?")[0]))
	if ext == "" {
		ext = ".mp4"
	}
	inputPath := filepath.Join(tmpDir, "input"+ext)
	setProductVideoProgress(jobID, 5)
	if err := config.DownloadURLToFile(ctx, source, inputPath); err != nil {
		log.Printf("[product-video] job %d download failed: %v", jobID, err)
		failProductVideoJob(jobID, source, "Không tải được video để xử lý")
		return
	}

	outputPath := filepath.Join(tmpDir, "output.mp4")
	setProductVideoProgress(jobID, 10)
	if err := transcodeProductVideo(ctx, inputPath, outputPath, func(percent int) {
		setProductVideoProgress(jobID, percent)
	}); err != nil {
		log.Printf("[product-video] job %d transcode failed: %v", jobID, err)
		failProductVideoJob(jobID, source, "Không chuyển được video. Hãy thử file khác.")
		return
	}

	buf, err := os.ReadFile(outputPath)
	if err != nil {
		failProductVideoJob(jobID, source, "Không xử lý được video")
		return
	}
	folder := fmt.Sprintf("products/%s/product-%d/video", safeProductType(productType), productID)
	outputURL, err := config.UploadToS3(buf, folder, "video.mp4", "video/mp4", false, true)
	if err != nil {
		log.Printf("[product-video] job %d upload failed: %v", jobID, err)
		failProductVideoJob(jobID, source, "Không lưu được video sau khi xử lý")
		return
	}

	var apply bool
	err = config.DB.QueryRow(ctx, `
		UPDATE product_video_job
		SET status = 'ready', output_url = $1, updated_at = NOW()
		WHERE id = $2 AND status = 'processing'
		RETURNING apply_on_success`,
		outputURL, jobID).Scan(&apply)
	if err == pgx.ErrNoRows {
		_, _ = config.DeleteFromS3(outputURL)
		_, _ = config.DeleteFromS3(source)
		return
	}
	if err != nil {
		log.Printf("[product-video] job %d finish failed: %v", jobID, err)
		_, _ = config.DeleteFromS3(outputURL)
		return
	}
	_, _ = config.DeleteFromS3(source)
	if apply {
		if err := applyProductVideo(ctx, productID, outputURL); err != nil {
			log.Printf("[product-video] job %d attach failed: %v", jobID, err)
		}
	}
}

func failProductVideoJob(jobID int, source, message string) {
	tag, err := config.DB.Exec(context.Background(), `
		UPDATE product_video_job
		SET status = 'failed', error = $1, updated_at = NOW()
		WHERE id = $2 AND status = 'processing'`,
		message, jobID)
	if err != nil {
		log.Printf("[product-video] job %d mark failed: %v", jobID, err)
		return
	}
	if tag.RowsAffected() > 0 && source != "" {
		_, _ = config.DeleteFromS3(source)
	}
}

func applyProductVideo(ctx context.Context, productID int, outputURL string) error {
	current := currentProductVideoURL(ctx, productID)
	if _, err := config.DB.Exec(ctx, `UPDATE products SET video_url = $1 WHERE id = $2`, outputURL, productID); err != nil {
		return err
	}
	if current != "" && current != outputURL {
		_, _ = config.DeleteFromS3(current)
	}
	return nil
}

func loadProductVideoTarget(w http.ResponseWriter, r *http.Request) (int, string, bool) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil || productID <= 0 {
		handlers.BadRequest(w, "Sản phẩm không hợp lệ")
		return 0, "", false
	}
	var productType string
	if err := config.DB.QueryRow(r.Context(), `SELECT type FROM products WHERE id = $1`, productID).Scan(&productType); err != nil {
		handlers.NotFound(w)
		return 0, "", false
	}
	return productID, productType, true
}

func productVideoIDs(w http.ResponseWriter, r *http.Request) (int, int, bool) {
	productID, err := strconv.Atoi(chi.URLParam(r, "id"))
	jobID, jobErr := strconv.Atoi(chi.URLParam(r, "jobId"))
	if err != nil || jobErr != nil || productID <= 0 || jobID <= 0 {
		handlers.BadRequest(w, "Video không hợp lệ")
		return 0, 0, false
	}
	return productID, jobID, true
}

func findProductVideoJob(ctx context.Context, productID, jobID int) (productVideoJob, error) {
	var job productVideoJob
	err := config.DB.QueryRow(ctx, `
		SELECT id, status, output_url, error, apply_on_success
		FROM product_video_job
		WHERE id = $1 AND product_id = $2`,
		jobID, productID).Scan(&job.ID, &job.Status, &job.OutputURL, &job.Error, &job.ApplyOnSuccess)
	if err == nil {
		fillProductVideoProgress(&job)
	}
	return job, err
}

func findLatestProductVideoJob(ctx context.Context, productID int) (productVideoJob, error) {
	var job productVideoJob
	err := config.DB.QueryRow(ctx, `
		SELECT id, status, output_url, error, apply_on_success
		FROM product_video_job
		WHERE product_id = $1
		ORDER BY id DESC
		LIMIT 1`,
		productID).Scan(&job.ID, &job.Status, &job.OutputURL, &job.Error, &job.ApplyOnSuccess)
	if err == nil {
		fillProductVideoProgress(&job)
	}
	return job, err
}

func currentProductVideoURL(ctx context.Context, productID int) string {
	var current *string
	if err := config.DB.QueryRow(ctx, `SELECT video_url FROM products WHERE id = $1`, productID).Scan(&current); err != nil || current == nil {
		return ""
	}
	return *current
}

func cancelReplaceableVideoJobs(ctx context.Context, productID int) ([]string, error) {
	current := currentProductVideoURL(ctx, productID)
	rows, err := config.DB.Query(ctx, `
		UPDATE product_video_job AS job
		SET status = 'cancelled', updated_at = NOW()
		FROM products
		WHERE products.id = job.product_id
		  AND job.product_id = $1
		  AND job.status IN ('uploading', 'processing', 'ready')
		  AND (job.output_url IS NULL OR job.output_url IS DISTINCT FROM products.video_url)
		RETURNING job.source_url, job.output_url`,
		productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var urls []string
	for rows.Next() {
		var source, output *string
		if err := rows.Scan(&source, &output); err != nil {
			return nil, err
		}
		if source != nil && *source != "" && *source != current {
			urls = append(urls, *source)
		}
		if output != nil && *output != "" && *output != current {
			urls = append(urls, *output)
		}
	}
	return urls, rows.Err()
}

func deleteVideoObjects(urls []string) {
	for _, url := range urls {
		if _, err := config.DeleteFromS3(url); err != nil {
			log.Printf("[product-video] delete %s: %v", url, err)
		}
	}
}

func deleteVideoObjectsExcept(keep string, urls ...*string) {
	for _, url := range urls {
		if url == nil || *url == "" || *url == keep {
			continue
		}
		if _, err := config.DeleteFromS3(*url); err != nil {
			log.Printf("[product-video] delete %s: %v", *url, err)
		}
	}
}

func productVideoFormat(contentType, filename string) (string, string, bool) {
	contentType = strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	if ext := productVideoMIMEs[contentType]; ext != "" {
		return contentType, ext, true
	}
	switch productVideoExt(filename) {
	case ".mp4":
		return "video/mp4", ".mp4", true
	case ".webm":
		return "video/webm", ".webm", true
	case ".mov":
		return "video/quicktime", ".mov", true
	default:
		return "", "", false
	}
}

func productVideoExt(name string) string {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".mp4", ".m4v":
		return ".mp4"
	case ".webm":
		return ".webm"
	case ".mov":
		return ".mov"
	default:
		return ""
	}
}

func safeProductType(productType string) string {
	productType = strings.Trim(productType, "/")
	if productType == "" || strings.Contains(productType, "..") || strings.ContainsAny(productType, `/\`) {
		return "product"
	}
	return productType
}

func setProductVideoProgress(jobID, percent int) {
	if percent < 0 {
		percent = 0
	}
	if percent > 99 {
		percent = 99
	}
	if current, ok := productVideoProgress.Load(jobID); ok {
		if previous, _ := current.(int); percent <= previous {
			return
		}
	}
	productVideoProgress.Store(jobID, percent)
}

func productVideoProgressOf(jobID int) int {
	value, ok := productVideoProgress.Load(jobID)
	if !ok {
		return 0
	}
	percent, _ := value.(int)
	return percent
}

func fillProductVideoProgress(job *productVideoJob) {
	if job.Status == "processing" {
		job.Progress = productVideoProgressOf(job.ID)
	}
}

func clearProductVideoProgress(jobID int) {
	productVideoProgress.Delete(jobID)
}

func probeVideoDuration(ctx context.Context, inputPath string) float64 {
	if _, err := exec.LookPath("ffprobe"); err != nil {
		return 0
	}
	out, err := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		inputPath,
	).Output()
	if err != nil {
		return 0
	}
	duration, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil || duration <= 0 {
		return 0
	}
	return duration
}

func transcodeProductVideo(ctx context.Context, inputPath, outputPath string, onProgress func(int)) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg not available")
	}
	duration := probeVideoDuration(ctx, inputPath)
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y",
		"-i", inputPath,
		"-vf", "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-crf", "26",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac",
		"-b:a", "96k",
		"-movflags", "+faststart",
		"-progress", "pipe:1",
		"-nostats",
		outputPath,
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Start(); err != nil {
		return err
	}

	lastPercent := 9
	var lastWrite time.Time
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if duration <= 0 || !strings.HasPrefix(line, "out_time_us=") || onProgress == nil {
			continue
		}
		micros, err := strconv.ParseFloat(strings.TrimPrefix(line, "out_time_us="), 64)
		if err != nil || micros <= 0 {
			continue
		}
		percent := 10 + int((micros/1e6)/duration*89)
		if percent <= lastPercent || (time.Since(lastWrite) < 500*time.Millisecond && percent < 99) {
			continue
		}
		if percent > 99 {
			percent = 99
		}
		lastPercent = percent
		lastWrite = time.Now()
		onProgress(percent)
	}
	if err := cmd.Wait(); err != nil {
		return fmt.Errorf("ffmpeg: %s", strings.TrimSpace(stderr.String()))
	}
	return nil
}

// AttachLatestVideoJobs adds the newest video job onto each admin product row.
func AttachLatestVideoJobs(products []map[string]any) {
	if len(products) == 0 {
		return
	}
	ids := make([]int32, 0, len(products))
	for _, product := range products {
		id, ok := productIDFromRow(product["id"])
		if ok {
			ids = append(ids, id)
		}
	}
	if len(ids) == 0 {
		return
	}
	rows, err := config.DB.Query(context.Background(), `
		SELECT DISTINCT ON (product_id)
			product_id, id, status, error, apply_on_success
		FROM product_video_job
		WHERE product_id = ANY($1)
		ORDER BY product_id, id DESC`, ids)
	if err != nil {
		log.Printf("[product-video] list jobs: %v", err)
		return
	}
	defer rows.Close()
	byProduct := map[int32]map[string]any{}
	for rows.Next() {
		var productID int32
		var jobID int
		var status string
		var jobError *string
		var apply bool
		if err := rows.Scan(&productID, &jobID, &status, &jobError, &apply); err != nil {
			log.Printf("[product-video] list job scan: %v", err)
			return
		}
		progress := 0
		if status == "processing" {
			progress = productVideoProgressOf(jobID)
		}
		byProduct[productID] = map[string]any{
			"status":         status,
			"progress":       progress,
			"error":          jobError,
			"applyOnSuccess": apply,
		}
	}
	for _, product := range products {
		id, ok := productIDFromRow(product["id"])
		if !ok {
			continue
		}
		if job, found := byProduct[id]; found {
			product["video_job"] = job
		}
	}
}

func productIDFromRow(value any) (int32, bool) {
	switch id := value.(type) {
	case int32:
		return id, true
	case int64:
		return int32(id), true
	case int:
		return int32(id), true
	default:
		return 0, false
	}
}

package config

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/chai2010/webp"
	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp" // register WebP decoder
)

var (
	S3Client   *s3.Client
	S3Endpoint string
	S3Bucket   string
)

var imageMimes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/tiff": true,
}

func InitS3() {
	S3Endpoint = getEnv("S3_ENDPOINT", "")
	region := getEnv("S3_REGION", "north1")
	S3Bucket = getEnv("S3_BUCKET", "inanhxink-prod")
	accessKey := getEnv("S3_ACCESS_KEY", "")
	secretKey := getEnv("S3_SECRET_KEY", "")

	if S3Endpoint == "" || accessKey == "" || secretKey == "" {
		log.Fatal("Missing S3 config: S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY required")
	}

	S3Client = s3.New(s3.Options{
		Region:       region,
		BaseEndpoint: aws.String(S3Endpoint),
		Credentials:  aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
		UsePathStyle: true,
	})
}

// GetPublicURL returns the raw S3 URL for a given key (stored in DB as-is).
func GetPublicURL(key string) string {
	return fmt.Sprintf("%s/%s/%s", S3Endpoint, S3Bucket, key)
}

// UploadToS3 uploads buf to S3 under folder/filename and returns the raw S3 URL.
// Images are converted to WebP (quality 90) unless noConvert=true (use for print-quality originals).
// Audio files are passed through unchanged.
func UploadToS3(buf []byte, folder, originalname, mimetype string, watermark, noConvert bool) (string, error) {
	uploadBuf := buf
	ext := strings.ToLower(filepath.Ext(originalname))
	contentType := mimetype

	if imageMimes[mimetype] {
		if noConvert {
			// Keep original bytes and format — needed for high-quality print files.
			// Still decode to validate the image is readable.
			if _, _, err := image.Decode(bytes.NewReader(buf)); err != nil {
				return "", fmt.Errorf("decode image: %w", err)
			}
		} else {
			img, _, err := image.Decode(bytes.NewReader(buf))
			if err != nil {
				return "", fmt.Errorf("decode image: %w", err)
			}
			if watermark {
				img, err = applyWatermark(img)
				if err != nil {
					return "", fmt.Errorf("apply watermark: %w", err)
				}
			}
			var out bytes.Buffer
			if err := webp.Encode(&out, img, &webp.Options{Lossless: false, Quality: 90}); err != nil {
				return "", fmt.Errorf("encode image to webp: %w", err)
			}
			uploadBuf = out.Bytes()
			ext = ".webp"
			contentType = "image/webp"
		}
	}

	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixMilli(), randStr(8), ext)
	key := filename
	if folder != "" {
		key = folder + "/" + filename
	}

	_, err := S3Client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(S3Bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(uploadBuf),
		ContentType: aws.String(contentType),
		ACL:         s3types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		return "", fmt.Errorf("S3 upload: %w", err)
	}
	return GetPublicURL(key), nil
}

// MoveTempS3Image moves a temp product-orders image to the permanent paid/ prefix.
// If the URL is not a temp upload (or belongs to a different origin), it is returned unchanged.
// On copy success the original is deleted (best-effort). Errors are non-fatal so callers
// can log and keep the temp URL rather than blocking order creation.
func MoveTempS3Image(rawURL string, orderID int) (string, error) {
	origin := S3Endpoint + "/" + S3Bucket + "/"
	if !strings.HasPrefix(rawURL, origin) {
		return rawURL, nil
	}
	key := rawURL[len(origin):]
	const tempPrefix = "product-orders/temp/"
	if !strings.HasPrefix(key, tempPrefix) {
		return rawURL, nil
	}

	parts := strings.Split(key, "/")
	filename := parts[len(parts)-1]
	dstKey := fmt.Sprintf("product-orders/paid/%d/%s", orderID, filename)

	_, err := S3Client.CopyObject(context.Background(), &s3.CopyObjectInput{
		Bucket:     aws.String(S3Bucket),
		CopySource: aws.String(S3Bucket + "/" + key),
		Key:        aws.String(dstKey),
		ACL:        s3types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		return rawURL, fmt.Errorf("S3 copy %s: %w", key, err)
	}

	// Best-effort delete of the original temp object
	S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{ //nolint
		Bucket: aws.String(S3Bucket),
		Key:    aws.String(key),
	})

	return GetPublicURL(dstKey), nil
}

// RewriteTemplateDataURLs walks a JSON blob and moves every S3 object whose key
// starts with srcKeyPrefix to dstFolder/{filename}. It returns the rewritten JSON
// and the list of original S3 keys that were successfully copied so the caller can
// delete them after the DB update. Individual copy failures are logged and the
// original URL is kept in the output — the overall operation is never aborted.
func RewriteTemplateDataURLs(raw []byte, srcKeyPrefix, dstFolder string) (rewritten []byte, copiedSrcKeys []string, err error) {
	if len(raw) == 0 {
		return raw, nil, nil
	}
	var data any
	if jsonErr := json.Unmarshal(raw, &data); jsonErr != nil {
		return raw, nil, fmt.Errorf("unmarshal template_data: %w", jsonErr)
	}
	origin := S3Endpoint + "/" + S3Bucket + "/"
	rewriteJSONValue(data, origin, srcKeyPrefix, dstFolder, &copiedSrcKeys)
	out, jsonErr := json.Marshal(data)
	if jsonErr != nil {
		return raw, nil, fmt.Errorf("marshal template_data: %w", jsonErr)
	}
	return out, copiedSrcKeys, nil
}

func rewriteJSONValue(v any, origin, srcKeyPrefix, dstFolder string, copied *[]string) {
	switch val := v.(type) {
	case map[string]any:
		for k, item := range val {
			if s, ok := item.(string); ok {
				if newURL, srcKey, moved := moveS3TempURL(s, origin, srcKeyPrefix, dstFolder); moved {
					val[k] = newURL
					*copied = append(*copied, srcKey)
				}
			} else {
				rewriteJSONValue(item, origin, srcKeyPrefix, dstFolder, copied)
			}
		}
	case []any:
		for i, item := range val {
			if s, ok := item.(string); ok {
				if newURL, srcKey, moved := moveS3TempURL(s, origin, srcKeyPrefix, dstFolder); moved {
					val[i] = newURL
					*copied = append(*copied, srcKey)
				}
			} else {
				rewriteJSONValue(item, origin, srcKeyPrefix, dstFolder, copied)
			}
		}
	}
}

func moveS3TempURL(rawURL, origin, srcKeyPrefix, dstFolder string) (newURL, srcKey string, moved bool) {
	if !strings.HasPrefix(rawURL, origin) {
		return rawURL, "", false
	}
	key := rawURL[len(origin):]
	if !strings.HasPrefix(key, srcKeyPrefix) {
		return rawURL, "", false
	}
	parts := strings.Split(key, "/")
	filename := parts[len(parts)-1]
	dstKey := dstFolder + "/" + filename
	_, err := S3Client.CopyObject(context.Background(), &s3.CopyObjectInput{
		Bucket:     aws.String(S3Bucket),
		CopySource: aws.String(S3Bucket + "/" + key),
		Key:        aws.String(dstKey),
		ACL:        s3types.ObjectCannedACLPublicRead,
	})
	if err != nil {
		log.Printf("warn: moveS3TempURL: CopyObject %s → %s: %v", key, dstKey, err)
		return rawURL, "", false
	}
	return GetPublicURL(dstKey), key, true
}

// DeleteS3Objects deletes a list of S3 keys best-effort (errors are logged, not returned).
func DeleteS3Objects(keys []string) {
	for _, key := range keys {
		if _, err := S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
			Bucket: aws.String(S3Bucket),
			Key:    aws.String(key),
		}); err != nil {
			log.Printf("warn: DeleteS3Objects: DeleteObject %s: %v", key, err)
		}
	}
}

func applyWatermark(img image.Image) (image.Image, error) {
	watermarkPath, err := findWatermarkPath()
	if err != nil {
		return img, err
	}
	wm, err := imaging.Open(watermarkPath)
	if err != nil {
		return img, fmt.Errorf("open watermark: %w", err)
	}
	w := img.Bounds().Dx()
	h := img.Bounds().Dy()
	wmWidth := int(float64(w) * 0.3)
	margin := int(float64(w) * 0.03)
	wm = trimBackground(wm)
	wm = imaging.Resize(wm, wmWidth, 0, imaging.Lanczos)
	left := w - wm.Bounds().Dx() - margin
	top := h - wm.Bounds().Dy() - margin
	return imaging.Overlay(img, wm, image.Pt(left, top), 1.0), nil
}

func trimBackground(img image.Image) image.Image {
	bounds := img.Bounds()
	if bounds.Empty() {
		return img
	}

	bg := color.NRGBAModel.Convert(img.At(bounds.Min.X, bounds.Min.Y)).(color.NRGBA)
	const threshold = 12
	isBackground := func(c color.Color) bool {
		p := color.NRGBAModel.Convert(c).(color.NRGBA)
		return absDiff(p.R, bg.R) <= threshold &&
			absDiff(p.G, bg.G) <= threshold &&
			absDiff(p.B, bg.B) <= threshold &&
			absDiff(p.A, bg.A) <= threshold
	}

	minX, minY := bounds.Max.X, bounds.Max.Y
	maxX, maxY := bounds.Min.X, bounds.Min.Y
	found := false
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if isBackground(img.At(x, y)) {
				continue
			}
			if x < minX {
				minX = x
			}
			if y < minY {
				minY = y
			}
			if x+1 > maxX {
				maxX = x + 1
			}
			if y+1 > maxY {
				maxY = y + 1
			}
			found = true
		}
	}
	if !found {
		return img
	}
	return imaging.Crop(img, image.Rect(minX, minY, maxX, maxY))
}

func absDiff(a, b uint8) int {
	if a > b {
		return int(a - b)
	}
	return int(b - a)
}

func findWatermarkPath() (string, error) {
	candidates := []string{
		"public/watermark.png",
		"backend-golang/public/watermark.png",
		"backend/public/watermark.png",
		"frontend-app/public/watermark.png",
	}
	for _, path := range candidates {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}
	return "", fmt.Errorf("watermark file not found")
}

// ExtractKeyFromURL converts a public S3 URL back to its object key.
// Returns ("", false) for URLs outside this bucket.
func ExtractKeyFromURL(url string) (string, bool) {
	prefix := fmt.Sprintf("%s/%s/", S3Endpoint, S3Bucket)
	if !strings.HasPrefix(url, prefix) {
		return "", false
	}
	key := url[len(prefix):]
	return key, key != ""
}

// DeleteFromS3 deletes the S3 object at the given public URL.
// Returns (false, nil) for URLs outside this bucket (safe no-op).
func DeleteFromS3(url string) (bool, error) {
	key, ok := ExtractKeyFromURL(url)
	if !ok {
		return false, nil
	}
	_, err := S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return false, err
	}
	return true, nil
}

func randStr(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

package config

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"math/rand"
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
// Images are converted to WebP (quality 90) via github.com/chai2010/webp (CGO/libwebp).
// Audio files are passed through unchanged.
func UploadToS3(buf []byte, folder, originalname, mimetype string, watermark bool) (string, error) {
	uploadBuf := buf
	ext := strings.ToLower(filepath.Ext(originalname))
	contentType := mimetype

	if imageMimes[mimetype] {
		img, _, err := image.Decode(bytes.NewReader(buf))
		if err != nil {
			return "", fmt.Errorf("decode image: %w", err)
		}
		if watermark {
			img, err = applyWatermark(img)
			if err != nil {
				log.Printf("[s3] watermark failed: %v", err)
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

func applyWatermark(img image.Image) (image.Image, error) {
	watermarkPath := "public/watermark.png"
	wm, err := imaging.Open(watermarkPath)
	if err != nil {
		return img, fmt.Errorf("open watermark: %w", err)
	}
	w := img.Bounds().Dx()
	h := img.Bounds().Dy()
	wmWidth := int(float64(w) * 0.3)
	margin := int(float64(w) * 0.03)
	wm = imaging.Resize(wm, wmWidth, 0, imaging.Lanczos)
	left := w - wm.Bounds().Dx() - margin
	top := h - wm.Bounds().Dy() - margin
	return imaging.Overlay(img, wm, image.Pt(left, top), 1.0), nil
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

// PruneS3Folder deletes all objects under prefix except the provided keep set.
func PruneS3Folder(prefix string, keep map[string]bool) error {
	out, err := S3Client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
		Bucket: aws.String(S3Bucket),
		Prefix: aws.String(prefix + "/"),
	})
	if err != nil {
		return err
	}
	for _, obj := range out.Contents {
		if obj.Key != nil && !keep[*obj.Key] {
			if _, err := S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
				Bucket: aws.String(S3Bucket),
				Key:    obj.Key,
			}); err != nil {
				log.Printf("[s3] prune delete failed for %s: %v", *obj.Key, err)
			}
		}
	}
	return nil
}

func randStr(n int) string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}


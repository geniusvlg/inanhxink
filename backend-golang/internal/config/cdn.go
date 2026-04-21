// CDN URL rewrite — single source of truth for the storage rule:
//
//	STORE in DB:   raw S3 origin URL
//	SERVE via API: rewritten CDN URL
//
// Public routes rewrite; admin routes do NOT.
package config

import (
	"fmt"
	"os"
	"strings"
)

var (
	s3Origin string
	CDNBase  string
)

func InitCDN() {
	endpoint := os.Getenv("S3_ENDPOINT")
	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		bucket = "inanhxink-prod"
	}
	s3Origin = fmt.Sprintf("%s/%s", endpoint, bucket)
	CDNBase = os.Getenv("CDN_BASE_URL")
}

// RewriteS3ToCdn rewrites a single S3 URL to the CDN. Accepts any value so
// callers can map over slices of mixed types without type-narrowing first.
func RewriteS3ToCdn(url any) any {
	s, ok := url.(string)
	if !ok {
		return url
	}
	return CdnStr(s)
}

// CdnStr rewrites a string URL (never nil). Returns unchanged if CDN not configured.
func CdnStr(url string) string {
	if CDNBase == "" || !strings.HasPrefix(url, s3Origin) {
		return url
	}
	return CDNBase + url[len(s3Origin):]
}

// CdnURLField rewrites a string field in a row map in-place.
func CdnURLField(row map[string]any, field string) {
	if v, ok := row[field].(string); ok {
		row[field] = CdnStr(v)
	}
}

// CdnArrayField rewrites every string element of a []any field in a row map.
func CdnArrayField(row map[string]any, field string) {
	if v, ok := row[field].([]any); ok {
		for i, item := range v {
			if s, ok := item.(string); ok {
				v[i] = CdnStr(s)
			}
		}
	}
}

package middleware

import (
	"fmt"
	"net/http"
	"time"
)

// Logger logs each HTTP request with method, path, status code, and duration.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		ms := time.Since(start).Milliseconds()
		color := "\x1b[32m"
		if rw.status >= 500 {
			color = "\x1b[31m"
		} else if rw.status >= 400 {
			color = "\x1b[33m"
		}
		fmt.Printf("%s%s\x1b[0m %s %d %dms\n", color, r.Method, r.RequestURI, rw.status, ms)
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.ResponseWriter.WriteHeader(status)
}

package middleware

import (
	"log"
	"net/http"
	"time"
)

// Logger logs each HTTP request to stderr (docker logs) and Sentry Logs.
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		ms := time.Since(start).Milliseconds()
		if rw.status >= 500 {
			log.Printf("HTTP error %d %s %s %dms", rw.status, r.Method, r.RequestURI, ms)
		} else if rw.status >= 400 {
			log.Printf("HTTP warn %d %s %s %dms", rw.status, r.Method, r.RequestURI, ms)
		} else {
			log.Printf("HTTP %d %s %s %dms", rw.status, r.Method, r.RequestURI, ms)
		}
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

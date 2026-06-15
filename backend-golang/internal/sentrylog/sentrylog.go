// Package sentrylog initialises Sentry and wires the standard log package to
// forward every log line to the Sentry Logs product.
package sentrylog

import (
	"context"
	"io"
	"log"
	"os"
	"strings"
	"time"

	sentry "github.com/getsentry/sentry-go"
)

// logWriter forwards each log line to Sentry at the appropriate level.
// It is used alongside os.Stderr via io.MultiWriter so container logs are
// preserved while also appearing in Sentry Logs.
type logWriter struct {
	ctx context.Context
}

func (w *logWriter) Write(p []byte) (n int, err error) {
	msg := strings.TrimSpace(string(p))
	if msg == "" {
		return len(p), nil
	}

	logger := sentry.NewLogger(w.ctx)
	lower := strings.ToLower(msg)

	switch {
	case strings.Contains(lower, "fatal"):
		logger.LFatal().Emit(msg) // LFatal logs without os.Exit
	case strings.Contains(lower, "error") ||
		strings.Contains(lower, "fail") ||
		strings.Contains(lower, "internal error"):
		logger.Error().Emit(msg)
	case strings.Contains(lower, "warn"):
		logger.Warn().Emit(msg)
	default:
		logger.Info().Emit(msg)
	}

	return len(p), nil
}

// Init configures Sentry and routes all future log.Printf calls to Sentry Logs.
// It is a no-op if dsn is empty so local dev (no SENTRY_DSN) is unaffected.
func Init(dsn, env, release string) {
	if dsn == "" {
		return
	}

	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      env,
		Release:          release,
		EnableLogs:       true,
		TracesSampleRate: 0.05,
	}); err != nil {
		log.Printf("[sentry] init failed: %v", err)
		return
	}

	ctx := context.Background()
	log.SetOutput(io.MultiWriter(os.Stderr, &logWriter{ctx: ctx}))
	log.Printf("[sentry] initialised (env=%s release=%s)", env, release)
}

// CaptureException sends err to Sentry as a full exception event (with stack
// trace). Call this from InternalError so 5xx failures appear in Sentry Issues.
func CaptureException(err error) {
	if err == nil {
		return
	}
	sentry.CaptureException(err)
}

// Flush waits for pending Sentry events to be delivered before the process
// exits. Call this with defer in main().
func Flush() {
	sentry.Flush(2 * time.Second)
}

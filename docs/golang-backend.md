# Go Backend (`backend-golang/`)

## ⚠️ Deployment checklist — read before deploying

The Go backend still uses WebP support for product catalog images and other
standard uploads. Product-order customer images under `product-orders/` are an
exception: they keep the original file bytes and extension for print quality.

`config.UploadToS3` (`internal/config/s3.go`) always decodes with
`imaging.Decode(..., imaging.AutoOrientation(true))`, not the stdlib
`image.Decode` — phone photos store landscape pixel data plus an EXIF
orientation tag telling viewers how to rotate it, and WebP has nowhere
reliable to carry that tag onward, so skipping this bakes a sideways/upside-
down photo into the output. It also caps the longer side to
`maxImageDimension` (2400px) before encoding: template pages preload/decode
every gallery photo up front, and letting camera originals (4000px+) through
uncapped can exceed mobile Safari's per-tab memory budget, causing it to
silently kill and reload the tab (looks like the page "restarted" on its
own). Neither applies to the `noConvert` (print) path, which must keep the
original resolution/bytes.

### 1. Install libwebp on the server

The Go backend encodes standard uploaded images as WebP using
`github.com/chai2010/webp`, which is a CGO wrapper around **libwebp**. The
library must be present on the machine (or Docker image) that **builds** the
binary.

```bash
# Debian / Ubuntu (production server / Docker)
apt-get install -y libwebp-dev

# macOS (local dev)
brew install webp pkg-config
```

Then build with CGO enabled (it's on by default, but make it explicit):

```bash
CGO_ENABLED=1 go build -o bin/server ./cmd/server
```

The production Docker image is built by `backend-golang/Dockerfile` using the
repository root as build context. It keeps the Compose service/image name
`backend`, but runs the Go binary instead of the Node.js server.

If you use or modify the multi-stage Docker build, **libwebp-dev must be in the builder stage** and **libwebp (runtime lib) must be in the final stage**:

```dockerfile
# Builder
FROM golang:1.26 AS builder
RUN apt-get update && apt-get install -y libwebp-dev pkg-config
WORKDIR /app
COPY . .
RUN CGO_ENABLED=1 go build -o /server ./cmd/server

# Runtime
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y libwebp7 ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /server /server
COPY public/ /public/
ENTRYPOINT ["/server"]
```

> The runtime package name is `libwebp7` on Debian 12 (Bookworm). Check with `apt-cache search libwebp` if unsure.

### 2. Copy `.env` file

The Go server reads the same `.env` as the Node.js backend (loaded via `godotenv`). Copy or symlink it:

```bash
cp /path/to/backend/.env /path/to/backend-golang/.env
```

Or set environment variables directly in your Docker Compose / systemd service instead.

### 3. Static files (`public/`)

The Go server serves static files from a `public/` directory **relative to the working directory** where the binary runs:

- `public/uploads/` — uploaded files (if using local storage)
- `public/templates/` — HTML template pages (galaxy, loveletter, etc.)
- `public/watermark.png` — watermark applied to product images

If `watermark=true` is passed to `/api/upload`, the server must be able to read
`public/watermark.png`; otherwise the upload fails instead of silently saving an
unwatermarked image.

Make sure these are available at the expected path when the server starts. The
production Dockerfile copies:

- `backend-golang/public/` → `/public/`
- `backend/public/templates/` → `/public/templates/`

For other Docker builds, copy them similarly:

```dockerfile
COPY public/ /public/
WORKDIR /
```

Or mount them as a volume in `docker-compose.yml`.

### 4. Database migrations

The Go backend connects to the **same PostgreSQL database** as the Node.js
backend. Schema changes live in `backend-golang/database/` during the Go
migration work. Apply new SQL migrations before deploying features that depend on
them, for example `V41__product_max_upload_images.sql`.

### 5. Port

Defaults to `3001` (same as Node.js). Set `PORT=` in `.env` to change.

### 6. `yt-dlp` for music extraction

The `/api/music/extract` and music download in `/api/orders` call `yt-dlp` as an external process. Make sure it's installed on the server:

```bash
# Debian/Ubuntu
pip3 install yt-dlp
# or
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
```

**Docker image staleness:** the Dockerfile fetches the "latest" yt-dlp release
at *build* time, but Docker/GHA layer caching means that layer can go
unchanged (and therefore stale) across many rebuilds. `docker-entrypoint.sh`
self-updates yt-dlp (`yt-dlp -U`, best-effort with a timeout) on every
container start to avoid shipping a version that's months behind TikTok's/
YouTube's latest anti-bot changes.

**TikTok "Unexpected response from webpage request":** TikTok serves a JS
anti-bot challenge to yt-dlp's default HTTP User-Agent (which yt-dlp's
built-in challenge solver often can't clear), but serves the real page
straight away to an ordinary browser UA. `downloadAndUploadMusic` in
`internal/handlers/music.go` always passes `--user-agent` with a Chrome UA
string to work around this — updating yt-dlp alone does not reliably fix it.
Keep the UA version reasonably current; TikTok's check is sensitive to stale
ones. This challenge is TikTok-side and changes without notice — if it starts
failing again for *most*/*all* TikTok links, check for an open issue at
[yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp/issues) before assuming
something's broken locally; it's usually fixed upstream within days and
`docker-entrypoint.sh`'s self-update picks it up automatically on next
container restart.

The challenge is also flaky moment-to-moment — a link that fails once often
succeeds seconds later with zero other change (observed: customers clicking
"Kiểm tra" a second time routinely get through). `extractWithRetries` retries
up to `musicExtractMaxAttempts` (3) times with a short backoff, but only when
the failure looks like the anti-bot signature — a genuinely bad/unsupported
URL fails fast instead of retrying pointlessly.

**TikTok "photo" posts (slideshow + music, no video stream):** these resolve
to a `/photo/<id>` URL that yt-dlp's TikTok extractor doesn't recognize at
all (falls back to the generic extractor, errors "Unsupported URL" — see
[yt-dlp#15764](https://github.com/yt-dlp/yt-dlp/issues/15764), still open).
`downloadAndUploadMusic` detects this specific failure and retries against
the equivalent `/video/<id>` URL (with its own anti-bot retries), which
often still yields the post's audio track — confirmed working end-to-end in
testing. If the rewrite still fails (or can't even be attempted, e.g. the
URL didn't parse), the error is classified from whichever attempt actually
ran last — `music.go` maps that to a short Vietnamese message via
`friendlyYtDlpError` (anti-bot signature vs. generic fallback; there's
deliberately no "unsupported photo post" message since the rewrite makes
that case unreachable in practice — see the `git log` for this file if that
logic needs revisiting). The full yt-dlp output is always logged server-side
(`[music-extract] yt-dlp failed for ...`) for debugging.

---

## Running locally

```bash
cd backend-golang
cp .env.example .env   # fill in credentials
CGO_ENABLED=1 go run ./cmd/server
```

## QR payment ownership

Customer uploads go to `uploads/{qrName}/` before payment. When a payment webhook
marks an order as paid, the Go backend serializes activation for that QR name,
cancels other unpaid orders with the same `qr_name`, and prunes the shared S3
folder so only objects referenced by the paid order's `template_data` remain.

QR voice messages use `POST /api/upload/voice`, which accepts one browser-recorded
audio file up to 5 MB under `uploads/temp/{qrName}/`. `CreateOrder` validates the
raw S3 URL, applies the server-side `voice_recording_price`, and stores it as
`template_data.voiceRecordingUrl`; payment activation moves it to the permanent
QR folder.

## Pay2S webhook discovery

`POST /api/payments/webhook/pay2s` is a temporary discovery endpoint for the
Pay2S migration. It logs the incoming method, path, remote address, query string,
headers, and raw body, then returns `{ "success": true }`. Do not use it for
payment fulfillment until the provider payload and verification scheme are known.

## Product order images

Product checkout uploads customer images to
`product-orders/temp/{cart_session_id}/`. `CreateProductOrder` must not move
these files to `paid/`; unpaid orders should remain in temp and expire by S3
lifecycle.

Product-order VietQR payment details use `SEPAY_PRODUCT_ACCOUNT_NO`,
`SEPAY_PRODUCT_ACCOUNT_NAME`, and `SEPAY_PRODUCT_BANK`, falling back to the
generic `SEPAY_ACCOUNT_NO`, `SEPAY_ACCOUNT_NAME`, and `SEPAY_BANK` values if the
product-specific variables are not set.

When `ProductPaymentWebhook` confirms payment, the backend marks the order paid,
stores the provider `referenceCode` on `product_transaction`, then moves
referenced images to `product-orders/paid/{order_id}/` and rewrites
`product_orders.items`. QR-template payment webhooks store the same
`referenceCode` on `qr_transaction`.

For print quality, uploads under `product-orders/` bypass WebP conversion and
store the original image bytes/extension.

See `docs/product-orders-fulfillment.md` for the full flow and lifecycle rules.

## Admin email (new orders)

Admins set SMTP and recipients only in **`/admin/config`** (`metadata` keys `notify_*`). There is **no** `.env` fallback for these fields. The SMTP password is stored in the database only; it is **never** returned by the API (only `notify_smtp_password_set`) and is **omitted** from public `GET /api/metadata`.

When recipients plus host and from are present in metadata, the server sends plain-text mail to admins **only after payment is confirmed**:

- **QR / template orders** — when `POST /api/payments/webhook/qr` marks the order paid, or admin `PATCH` sets `payment_status` to `paid` (transition from non-`paid`).
- **Product orders** — when `handleProductOrderWebhook` marks the order paid, or admin `PATCH` on product order status sets `paid` (transition from non-`paid`).

`notify_smtp_port` defaults to `587` when unset. If user and password are both empty, mail is sent without AUTH (useful for local MailHog). Errors are logged and never fail the HTTP request.

## Tech stack summary

| Concern | Library |
|---|---|
| HTTP router | chi v5 |
| PostgreSQL | pgx v5 |
| S3 storage | aws-sdk-go-v2 |
| JWT auth | golang-jwt/jwt v5 |
| Passwords | golang.org/x/crypto/bcrypt |
| Image processing + WebP encode | disintegration/imaging + chai2010/webp (CGO) |
| WebP decode | golang.org/x/image/webp |
| Env loading | godotenv |

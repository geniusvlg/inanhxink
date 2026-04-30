# Go Backend (`backend-golang/`)

## ⚠️ Deployment checklist — read before deploying

The Go backend still uses WebP support for product catalog images and other
standard uploads. Product-order customer images under `product-orders/` are an
exception: they keep the original file bytes and extension for print quality.

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

## Product order images

Product checkout uploads customer images to
`product-orders/temp/{cart_session_id}/`. `CreateProductOrder` must not move
these files to `paid/`; unpaid orders should remain in temp and expire by S3
lifecycle.

When `ProductPaymentWebhook` confirms payment, the backend marks the order paid,
then moves referenced images to `product-orders/paid/{order_id}/` and rewrites
`product_orders.items`.

For print quality, uploads under `product-orders/` bypass WebP conversion and
store the original image bytes/extension.

See `docs/product-orders-fulfillment.md` for the full flow and lifecycle rules.

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

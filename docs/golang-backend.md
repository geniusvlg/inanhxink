# Go Backend (`backend-golang/`)

## ⚠️ Deployment checklist — read before deploying

### 1. Install libwebp on the server

The Go backend encodes all uploaded images as WebP using `github.com/chai2010/webp`, which is a CGO wrapper around **libwebp**. The library must be present on the machine (or Docker image) that **builds** the binary.

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

If you use a multi-stage Docker build, **libwebp-dev must be in the builder stage** and **libwebp (runtime lib) must be in the final stage**:

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

Make sure these are available at the expected path when the server starts. In Docker, copy them:

```dockerfile
COPY public/ /public/
WORKDIR /
```

Or mount them as a volume in `docker-compose.yml`.

### 4. No database migrations

The Go backend connects to the **same PostgreSQL database** as the Node.js backend — no schema changes needed. Run migrations only from the Node.js side (`npm run db:init`).

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

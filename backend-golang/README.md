# inanhxink — Go Backend

Go 1.26 port of the Node.js/Express backend. Uses the same PostgreSQL database and S3 bucket — it's a drop-in API replacement.

## Tech stack

| Concern | Library |
|---|---|
| HTTP router | [chi v5](https://github.com/go-chi/chi) |
| PostgreSQL | [pgx v5](https://github.com/jackc/pgx) |
| S3 storage | [aws-sdk-go-v2](https://github.com/aws/aws-sdk-go-v2) |
| JWT auth | [golang-jwt/jwt v5](https://github.com/golang-jwt/jwt) |
| Passwords | `golang.org/x/crypto/bcrypt` |
| Image processing | [disintegration/imaging](https://github.com/disintegration/imaging) + [chai2010/webp](https://github.com/chai2010/webp) |
| Env loading | [godotenv](https://github.com/joho/godotenv) |

> **Images are encoded as WebP** (quality 90) using `github.com/chai2010/webp` — same as the Node.js version. This library requires CGO and **libwebp** at build time (`brew install webp` on macOS; `apt install libwebp-dev` on Debian/Ubuntu). The `golang.org/x/image/webp` decoder is also registered so the server can read incoming WebP uploads.

## Project structure

```
cmd/server/main.go          — entry point, router wiring
internal/
  config/
    db.go                   — pgxpool connection
    s3.go                   — S3 upload/delete helpers
    cdn.go                  — S3 → CDN URL rewriting
  middleware/
    auth.go                 — RequireAdmin JWT middleware
    logger.go               — coloured HTTP request logger
  handlers/
    *.go                    — public route handlers
    admin/
      *.go                  — admin (JWT-protected) handlers
```

## Running locally

```bash
# 1. Copy env
cp .env.example .env
# edit .env with your credentials

# 2. Build and run
go run ./cmd/server

# 3. Or build a binary
go build -o bin/server ./cmd/server
./bin/server
```

The server listens on `PORT` (default `3001`). All API routes are identical to the Node.js version.

## API parity

Every endpoint from the original Node.js backend is implemented:

- `GET /api/health`, `GET /api/test-db`
- `POST /api/upload`
- `GET /api/site-data`
- `GET/POST /api/orders`, `POST /api/orders/check-qr-name`
- `POST /api/payments`, `POST /api/payments/webhook`, `GET /api/payments/order/:id`, `GET /api/payments/qr/:name`
- `POST /api/vouchers/validate`
- `GET /api/templates`, `GET /api/templates/:id`
- `GET /api/products`, `GET /api/products/featured-on-home`, `GET /api/products/:id`
- `GET /api/categories`
- `GET /api/testimonials`
- `GET /api/banners`
- `GET /api/hero-shots`
- `GET /api/metadata`
- `POST /api/music/extract`
- `GET /api/qrcodes/:qrName`
- Admin routes under `/api/admin/…` (JWT-protected)
- Template catch-all for `*.inanhxink.com` subdomains

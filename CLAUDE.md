# CLAUDE.md

## Rules

- **Never `git commit` or `git push` autonomously.** Leave changes staged/unstaged in the working tree and let the user review, commit, and push themselves.
- At the start of every conversation, call `mcp__serena__initial_instructions` to confirm the active project and list existing memories (call `mcp__serena__onboarding` only if none exist yet). This repo's Serena server is registered **per-project** as `serena`. A separate `oraios-serena` server is registered **globally** in this machine's Claude config and is shared with other, unrelated projects — its tools (`mcp__oraios-serena__*`) are not scoped to this repo (even similarly-named ones like `check_onboarding_performed`) and must not be used here.
- Before working on a feature, skim the `docs/` folder for relevant docs (e.g. `docs/admin-app.md`, `docs/golang-backend.md`, `docs/feedback-feature.md`, `docs/claude-rules.md`); these are the source of truth for cross-cutting features and working conventions
- When asked to "remember" something, persist it in **both** Serena memory **and** a relevant file in `docs/` (create one if no existing doc fits). Keep `docs/` in sync whenever a feature, schema, or architecture detail changes
- Prefer Serena symbolic tools (`find_symbol`, `get_symbols_overview`, `search_for_pattern`, `replace_symbol_body`, `insert_after_symbol`) over full file reads. Only fall back to `Read`/`Edit` for files with no symbols (HTML, CSS, Markdown, plain text)
- Whenever the user asks to check, visit, inspect, or test a website/URL, use MCP Playwright tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_take_screenshot`, etc.) to open and interact with it
- Frontend code (`frontend-app/`, `admin-app/`) must be TypeScript (`.ts`/`.tsx`) — never plain JavaScript (`.js`/`.jsx`). The backend (`backend-golang/`) is Go — follow standard Go conventions.
- **Storage rule (S3 ↔ CDN)** — for all static assets (images, audio, etc.):
  1. Always **store the raw S3 URL** in the database (never store the CDN URL — admin tooling like deletes parses the bucket key out of it).
  2. Always **serve via CDN** to the public client. Apply the rewrite at *response time* in every public handler (`backend-golang/internal/handlers/*.go`) using helpers from `backend-golang/internal/config/cdn.go` (`CdnStr`, `CdnURLField`, `CdnArrayField`, `RewriteS3ToCdn`).
  3. **Admin handlers** (`backend-golang/internal/handlers/admin/*.go`) MUST NOT rewrite — admins need raw S3 URLs so deletes and verification work.
  4. When adding a new public endpoint that returns image fields, wire the rewrite immediately and confirm with `Network` tab that the response uses `cdn.inanhxink.com`.

## Project Overview

**inanhxink** — QR-code ordering system + product storefront. Customers buy a personalised subdomain (e.g. `anhyeuem.inanhxink.com`) serving a themed template page, or order physical products (thiệp, khung ảnh, in ảnh, etc).

- **Order site** (`inanhxink.com`) — customer storefront SPA (React + Vite + TypeScript) in `frontend-app/`
- **Admin site** — admin SPA (React + Vite + TypeScript, JWT auth) in `admin-app/`
- **Template pages** (`*.inanhxink.com`) — Static HTML/JS in `backend-golang/public/templates/`, served by the Go backend with `window.__SUBDOMAIN__` / `window.dataFromSubdomain` injected
- **Backend** — **Go 1.26** + chi router + pgx v5 in `backend-golang/`, PostgreSQL. This is a full rewrite of an earlier Node.js/Express backend (`backend/`, now deleted) — same DB/S3, API-compatible. See `docs/golang-backend.md` for deployment details (libwebp/CGO build requirement, `.env` layout, static file paths, yt-dlp dependency).
- **Infra** — `nginx/` for SSL + reverse proxy + wildcard subdomains, `docker-compose.yml`

## Commands

```bash
# Backend (Go)
cd backend-golang
cp .env.example .env                              # first-time
CGO_ENABLED=1 go run ./cmd/server                  # dev run (CGO needed for webp encode)
CGO_ENABLED=1 go build -o bin/server ./cmd/server  # build binary
go vet ./...
gofmt -l .

# Frontend (storefront) / Admin — same commands in frontend-app/ or admin-app/
cd frontend-app   # or admin-app
npm run dev       # Vite dev server
npm run build     # frontend-app: vite build; admin-app: tsc -b && vite build
npm run lint      # eslint .

# Production (full stack)
docker-compose up -d --build   # services: frontend, admin, postgres, flyway, backend (Go), nginx
```

Env: `backend-golang/.env` (copy from `.env.example`) needs `DOMAIN=inanhxink.com`, `DB_PASSWORD=<password>`, plus S3/Sepay/JWT/Sentry vars — see `.env.example` for the full list. DB migrations are Flyway SQL files in `backend-golang/database/`, applied automatically by the `flyway` Compose service.

## Architecture

```
Browser → nginx (:443)
  ├── inanhxink.com    → frontend-app static + /api/ → backend:3001 (Go)
  ├── admin.*          → admin-app static (served separately, JWT-protected API calls to backend:3001)
  └── *.inanhxink.com  → backend:3001 (Go template serving)
```

**API routes** (`/api/`, public): `health`, `upload`, `site-data`, `templates`, `vouchers`, `orders`, `qrcodes`, `payments`, `product-orders`, `music`, `metadata`, `products`, `testimonials`, `banners`, `hero-shots`, `categories`

**Admin API routes** (`/api/admin/`, JWT-protected): `auth`, `templates`, `orders`, `product-orders`, `vouchers`, `metadata`, `products`, and more — see `docs/admin-app.md`

**DB tables**: `templates`, `qr_codes` (JSONB `template_data`), `orders`, `vouchers`, `products`, `product_orders`, `categories`, `testimonials`, `banners`, and others added via Flyway migrations — use **singular** names for new tables (e.g. `product_transaction`, not `product_transactions`)

**Template types** — mapping in `backend-golang/internal/handlers/orders.go` (`validTemplateTypes`, `templateFolderMap`):
- `galaxy`, `loveletter`, `letterinspace`, `lovedays`, `birthday`, `birthdaycake`, `specialgift`, `farewell`
- Adding a template: folder in `backend-golang/public/templates/` + entries in `validTemplateTypes`/`templateFolderMap` + DB row. See `docs/qr-templates.md`.

**Key frontend files**: `OrderPage.tsx` (order form), `TemplatePreviewPage.tsx`, `QrCodePage.tsx`/`QrGeneratePage.tsx`, `services/api.ts` (Axios calls)

## Local Dev (without Docker)

1. Start PostgreSQL (e.g. via the `postgres` Compose service or a local install) and apply migrations from `backend-golang/database/`.
2. `cd backend-golang && cp .env.example .env`, filling in DB/S3/Sepay credentials for local dev.
3. `CGO_ENABLED=1 go run ./cmd/server` (macOS: `brew install webp pkg-config` first for CGO webp support).
4. `npm run dev` in both `frontend-app/` and `admin-app/`.
5. Preview templates: `http://localhost:3001/?preview=<qrName>`

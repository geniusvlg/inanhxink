# CLAUDE.md

## Rules

- **Never `git push` autonomously.** Always stop after committing locally. Let the user review and push themselves.
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

**inanhxink** — Vietnamese QR-code ordering system. Customers buy a personalised subdomain (e.g. `anhyeuem.inanhxink.com`) serving a themed template page, alongside a physical-product storefront (cards, photo frames, prints, scrapbooks, gifts).

- **Customer storefront** (`inanhxink.com`) — React 19 SPA (Vite + TypeScript) in `frontend-app/`
- **Admin app** (`admin.inanhxink.com`) — React 19 SPA (Vite + TypeScript) in `admin-app/`, JWT-authenticated; manages products, templates, orders, feedback, banners, config. See `docs/admin-app.md`.
- **Backend** — Go (chi v5) + PostgreSQL (pgx v5, raw SQL) in `backend-golang/`. **This replaced the old Node.js/Express backend** (`backend/`, removed entirely in commit `c3b2620`, April 2026) — don't reference `backend/` in new work. See `docs/golang-backend.md`.
- **Template pages** (`*.inanhxink.com`) — static HTML/JS in `backend-golang/public/templates/`, served by the Go backend with `window.__SUBDOMAIN__` / `window.dataFromSubdomain` injected
- **Infra** — `nginx/` for SSL + reverse proxy + wildcard subdomains, `docker-compose.yml`

## Commands

```bash
# Backend (Go)
cd backend-golang
CGO_ENABLED=1 go run ./cmd/server              # run locally
CGO_ENABLED=1 go build -o bin/server ./cmd/server   # build binary
# macOS local dev needs: brew install webp pkg-config (libwebp/CGO dependency)

# Customer storefront
cd frontend-app
npm run dev       # Vite on :5173, proxies /api → localhost:3001
npm run build     # Build to dist/

# Admin app
cd admin-app
npm run dev       # Vite dev server on :5174
npm run build     # tsc -b && vite build

# Production
docker-compose up -d --build
```

Env: `backend-golang/.env` (copy from `.env.example`) needs at minimum `DOMAIN`, `DB_HOST/PORT/USER/PASSWORD/NAME`; see `docs/golang-backend.md` for the full list (S3, CDN, JWT, SePay, SMTP).

## Architecture

```
Browser → nginx (:443)
  ├── inanhxink.com         → React static (frontend-app/dist) + /api/ → backend-golang:3001
  ├── admin.inanhxink.com   → React static (admin-app/dist)   + /api/ → backend-golang:3001
  └── *.inanhxink.com       → backend-golang:3001 (template serving)
```

**API routes** (`/api/`): `upload`, `site-data`, `templates`, `orders`, `vouchers`, `qrcodes`, `products`, `product-orders`, `payments`, `music`, `metadata`, plus JWT-protected `admin/*`

**DB tables**: `templates`, `qr_codes` (JSONB `template_data`), `orders`, `vouchers`, `products`, `product_categories`, `testimonials`, `banners`, `admin_users`, `metadata`, `product_orders`, `product_transaction`, `qr_transaction`. Migrations are versioned SQL in `backend-golang/database/V{n}__*.sql` (up to V46+), applied by the **`flyway`** service in `docker-compose.yml` — the Go binary itself does not run migrations on startup.

**Template types** — mapping in `backend-golang/internal/handlers/orders.go` (`templateFolderMap` / `validTemplateTypes`):
- `galaxy` → `galaxy`, `letterinspace` (legacy alias) → `galaxy`, `loveletter` → `loveletter`, `birthday` → `birthday`, `lovedays` → `lovedays`, `specialgift` → `specialgift`
- Adding a template: folder in `backend-golang/public/templates/` + entry in `templateFolderMap`/`validTemplateTypes` + DB row

**Key frontend files** (`frontend-app/src/`): `pages/CheckoutPage.tsx` (product checkout), `pages/OrderPage.tsx` (QR keychain order form), `pages/TemplatePreviewPage.tsx`, `pages/QrGeneratePage.tsx`, `pages/QrYeuThuongPage.tsx` (template listing), `services/api.ts`

**Key admin files** (`admin-app/src/`): `pages/ProductItemsPage.tsx` (shared product CRUD), `pages/FulfillmentPage.tsx`, `pages/ConfigPage.tsx`, `services/api.ts`. See `docs/admin-app.md`.

## Local Dev (without Docker)

1. `docker-compose up -d postgres flyway` — starts PostgreSQL and applies migrations (or point a local Postgres at the same schema and apply the SQL files in `backend-golang/database/` yourself)
2. `cd backend-golang && cp .env.example .env`, then fill in `DB_*` (see `docs/golang-backend.md` for the full env reference)
3. `CGO_ENABLED=1 go run ./cmd/server`
4. `npm run dev` in `frontend-app/` and/or `admin-app/`
5. Preview templates: `http://localhost:3001/?preview=<qrName>`

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

- Always call `mcp__serena__check_onboarding_performed` at the start of a conversation to load project context
- Use Serena tools to explore the codebase before making changes:
  - `mcp__serena__find_symbol` to locate classes and methods
  - `mcp__serena__get_symbols_overview` to understand a file's structure
  - `mcp__serena__search_for_pattern` to find patterns across the codebase
  - `mcp__serena__replace_symbol_body` and `mcp__serena__insert_after_symbol` to make edits
- Prefer Serena symbolic tools over full file reads to minimize token usage
- Only read full files when absolutely necessary

## Project Overview

**inanhxink** is a QR-code ordering system where customers purchase a personalised subdomain (e.g. `anhyeuem.inanhxink.com`) that serves a themed template page. The system has two user-facing surfaces:

1. **Order site** (`order.inanhxink.com`) — React SPA where customers choose a template, pick a `qr_name`, customise content, and submit an order.
2. **Template pages** (`<qr_name>.inanhxink.com`) — Static HTML/JS pages (stored in `backend/public/templates/`) that are served by Express with per-subdomain data injected as globals (`window.__SUBDOMAIN__`, `window.dataFromSubdomain`).

## Repository Layout

```
frontend-app/   React + Vite + TypeScript (order site)
backend/        Node.js + Express + TypeScript (API + template server)
nginx/          nginx.conf — SSL termination, reverse proxy, wildcard subdomain routing
docker-compose.yml
.env.production.example
```

## Commands

### Backend

```bash
cd backend
npm run dev          # Development: nodemon + ts-node (auto-restarts)
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled dist/server.js
npm run db:init      # Create tables and seed data (first-time setup)
```

### Frontend

```bash
cd frontend-app
npm run dev          # Vite dev server on :5173, proxies /api → localhost:3001
npm run build        # Build to frontend-app/dist/  (output served by nginx in prod)
npm run lint         # ESLint
npm run preview      # Preview the production build locally
```

### Production (Docker)

```bash
# From project root — requires .env with DOMAIN and DB_PASSWORD
docker-compose up -d --build

# After postgres is up, initialize the schema (first deploy only)
docker-compose exec backend npm run db:init
```

The root `.env` only needs two variables (see `.env.production.example`):
```
DOMAIN=inanhxink.com
DB_PASSWORD=<strong_password>
```

## Architecture

### Request Flow

```
Browser → nginx (:443)
  ├── order.inanhxink.com         → /var/www/order (React static) + /api/ → backend:3001
  └── *.inanhxink.com             → backend:3001 (Express catch-all)
```

**Subdomain resolution** (`backend/server.ts` — `getSubdomain()`):
- **Production**: first label of `Host` header (e.g. `anhle` from `anhle.inanhxink.com`).
- **Local dev**: `?preview=<name>` or `?sub=<name>` query param (also read from `Referer` so asset requests work).

**Template serving**: Express reads `backend/public/templates/<template_type>/index.html`, injects a `<script>` tag with `window.__SUBDOMAIN__` and `window.dataFromSubdomain` before `</head>`, and sends the result. Static assets (JS, CSS, images) within a template directory are served from that same directory.

### Backend (`backend/server.ts`)

| Mount | Description |
|---|---|
| `POST /api/upload` | multer, up to 20 files / 10 MB each (images + audio); saved to `public/uploads/` |
| `GET /api/site-data` | Returns `template_type` + `template_data` for a subdomain (used by template JS) |
| `/api/templates` | CRUD for template catalogue |
| `/api/orders` | Create order, check QR name availability, get order by ID |
| `/api/vouchers` | Validate & apply discount vouchers |
| `/api/qrcodes` | Lookup QR code by name |
| `app.use(...)` catch-all | Wildcard subdomain → inject globals → serve template HTML |

### Database Schema (`backend/database/schema.sql`)

| Table | Key columns |
|---|---|
| `templates` | `id`, `name`, `price`, `is_active` |
| `qr_codes` | `qr_name` (unique), `template_type`, `template_data` (JSONB) |
| `orders` | FK to `qr_codes` + `templates`, pricing fields, `status`, `payment_status` |
| `vouchers` | `code`, `discount_type` (`percentage`/`fixed`), `discount_value`, `max_uses` |

Order creation (`POST /api/orders`) is a transaction: it **upserts** `qr_codes` (allowing re-orders for the same name) then inserts into `orders`.

### Template Types

Available template folders under `backend/public/templates/`:

| Folder | Frontend `templateId` |
|---|---|
| `galaxy` | `letterinspace` |
| `christmas` | `christmastree` |
| `loveletter` | `loveletter` |

The mapping is in `backend/routes/orders.ts` (`TEMPLATE_TYPE_MAP`). Adding a new template requires: a folder in `backend/public/templates/`, an entry in `TEMPLATE_TYPE_MAP`, and a row in the `templates` DB table.

### Frontend (`frontend-app/`)

- `src/pages/OrderPage.tsx` — main multi-step order form
- `src/pages/TemplatePreviewPage.tsx` — preview a template by name
- `src/pages/QrCodePage.tsx` — display a submitted QR code
- `src/services/api.ts` — all Axios calls; base URL from `VITE_API_URL` env var (falls back to `http://localhost:3001`)
- `src/data/mockTemplates.ts` — static template metadata used before API is called

Vite dev server proxies `/api` → `localhost:3001` and `/backend-templates` → `localhost:3001/templates`, so no CORS issues during local development.

## Local Development (without Docker)

1. Start PostgreSQL (Docker shortcut): `cd backend && npm run db:docker`
2. Create `backend/.env`:
   ```
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=mysecretpassword
   DB_NAME=mydb
   PORT=3001
   NODE_ENV=development
   ```
3. `npm run db:init` (one-time)
4. `npm run dev` in `backend/`
5. `npm run dev` in `frontend-app/`
6. Preview a template page locally: `http://localhost:3001/?preview=<qrName>`

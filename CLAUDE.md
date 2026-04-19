# CLAUDE.md

## Rules

- At the start of every conversation, call `mcp__serena__check_onboarding_performed`; if onboarding has NOT been performed yet, immediately call `mcp__serena__onboarding` to onboard the project
- Before working on a feature, skim the `docs/` folder for relevant docs (e.g. `docs/admin-app.md`, `docs/feedback-feature.md`, `docs/claude-rules.md`); these are the source of truth for cross-cutting features and working conventions
- When asked to "remember" something, persist it in **both** Serena memory **and** a relevant file in `docs/` (create one if no existing doc fits). Keep `docs/` in sync whenever a feature, schema, or architecture detail changes
- Prefer Serena symbolic tools (`find_symbol`, `get_symbols_overview`, `search_for_pattern`, `replace_symbol_body`, `insert_after_symbol`) over full file reads. Only fall back to `Read`/`Edit` for files with no symbols (HTML, CSS, Markdown, plain text)
- Whenever the user asks to check, visit, inspect, or test a website/URL, use MCP Playwright tools (`mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`, `mcp__playwright__browser_take_screenshot`, etc.) to open and interact with it
- Always write new code in TypeScript (`.ts` / `.tsx`); never create plain JavaScript files (`.js` / `.jsx`)

## Project Overview

**inanhxink** — QR-code ordering system. Customers buy a personalised subdomain (e.g. `anhyeuem.inanhxink.com`) serving a themed template page.

- **Order site** (`inanhxink.com`) — React SPA (Vite + TypeScript) in `frontend-app/`
- **Template pages** (`*.inanhxink.com`) — Static HTML/JS in `backend/public/templates/`, served by Express with `window.__SUBDOMAIN__` / `window.dataFromSubdomain` injected
- **Backend** — Node.js + Express + TypeScript in `backend/`, PostgreSQL
- **Infra** — `nginx/` for SSL + reverse proxy + wildcard subdomains, `docker-compose.yml`

## Commands

```bash
# Backend
cd backend
npm run dev       # nodemon + ts-node
npm run build     # TypeScript → dist/
npm run db:init   # Create tables + seed (first-time)

# Frontend
cd frontend-app
npm run dev       # Vite on :5173, proxies /api → localhost:3001
npm run build     # Build to dist/

# Production
docker-compose up -d --build
docker-compose exec backend npm run db:init  # first deploy only
```

Env: `.env` needs `DOMAIN=inanhxink.com` and `DB_PASSWORD=<password>`

## Architecture

```
Browser → nginx (:443)
  ├── inanhxink.com    → React static + /api/ → backend:3001
  └── *.inanhxink.com  → backend:3001 (template serving)
```

**API routes** (`/api/`): `upload`, `site-data`, `templates`, `orders`, `vouchers`, `qrcodes`

**DB tables**: `templates`, `qr_codes` (JSONB `template_data`), `orders`, `vouchers`

**Template types** — mapping in `backend/routes/orders.ts` (`TEMPLATE_TYPE_MAP`):
- `galaxy` → `letterinspace`, `loveletter` → `loveletter`
- Adding a template: folder in `backend/public/templates/` + `TEMPLATE_TYPE_MAP` entry + DB row

**Key frontend files**: `OrderPage.tsx` (order form), `TemplatePreviewPage.tsx`, `QrCodePage.tsx`, `services/api.ts` (Axios calls)

## Local Dev (without Docker)

1. `cd backend && npm run db:docker` (start PostgreSQL)
2. Create `backend/.env`: `DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=mysecretpassword DB_NAME=mydb PORT=3001 NODE_ENV=development`
3. `npm run db:init`, then `npm run dev` in both `backend/` and `frontend-app/`
4. Preview templates: `http://localhost:3001/?preview=<qrName>`

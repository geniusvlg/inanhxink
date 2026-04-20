# Product-page banner

A small admin-configurable image carousel mounted at the top of each product
listing page hero (`/thiep`, `/khung-anh`, `/so-scrapbook`, `/set-qua-tang`,
`/cac-san-pham-khac`, `/in-anh`).

It is intentionally smaller and simpler than the homepage banner
(`docs/banner-feature.md`):

| | Homepage banner | Product-page banner |
|---|---|---|
| Max width | 1400 px | **960 px** |
| Aspect ratio | 16 : 6 | **16 : 4** |
| Source | `banners` table | `metadata` table (3 keys) |
| Per-page customisation | n/a | inherit / custom / disabled |
| Arrows | Yes | No (dots + auto-rotate only) |

## Behaviour

- Globally toggled by `product_banner_enabled` (default `false` after the
  V33 migration runs).
- Each of the six product pages can independently override:
  - **Inherit** (default) → show global slides
  - **Custom** → show that page's own slide list. An empty list hides the
    banner on that one page.
  - **Disabled** → hide the banner on that page even if global is on.
- When there's only one slide → no dots, no auto-rotate (renders as a static
  image). Two or more → dots + 5 s auto-rotate, paused on hover.
- Each slide is just `{ imageUrl, linkUrl? }`. No overlay text — admins bake
  any copy into the image itself.
- `linkUrl` accepts internal paths (`/thiep`, `/product/123`) which open via
  React Router, or absolute `https://…` URLs which open in a new tab.

## Data model

Stored in the `metadata` key/value table (no new tables needed). Three keys
seeded by `backend/database/V33__product_page_banner.sql`:

| Key | Type | Default |
|---|---|---|
| `product_banner_enabled` | `"true"` \| `"false"` | `"false"` |
| `product_banner_slides` | JSON `Slide[]` | `[]` |
| `product_banner_overrides` | JSON `Record<slug, { mode, slides? }>` | all six pages set to `{"mode":"inherit"}` |

```ts
type Slide = { imageUrl: string; linkUrl?: string };
type Mode  = 'inherit' | 'custom' | 'disabled';
type Override = { mode: Mode; slides?: Slide[] };

type Slug =
  | 'thiep' | 'khung_anh' | 'so_scrapbook'
  | 'set_qua_tang' | 'cac_san_pham_khac' | 'in_anh';
```

### Resolver

In `frontend-app/src/contexts/FeatureFlagsContext.tsx`:

1. If global `enabled === false` → no banner anywhere.
2. Else for each page, look at its override:
   - `inherit` → return global slides (or `null` if global slides is empty)
   - `custom` → return override slides (or `null` if empty)
   - `disabled` → return `null`

`useProductBanner(page)` returns `Slide[] | null` ready for the carousel.

## Storage / CDN rule

Per `docs/storage-cdn-rule.md` — every `imageUrl` in the DB is a **raw S3
URL**. The public `GET /api/metadata` route (`backend/routes/metadata.ts`)
parses `product_banner_slides` and the `slides` inside each
`product_banner_overrides` entry, rewrites each `imageUrl` to the CDN host
via `cdnUrl`, and re-stringifies before responding. The admin
`GET /api/admin/metadata` route does **not** rewrite — admins need raw S3
URLs so deletes via `uploadApi.deleteMany` work.

Uploads go through `POST /api/upload?prefix=product-banner` (sanitised to
`product-banner` by `backend/server.ts`).

## File structure

```
backend/
  database/V33__product_page_banner.sql        # new — seeds 3 metadata keys
  routes/metadata.ts                           # rewrites slide imageUrls → CDN

frontend-app/src/
  contexts/FeatureFlagsContext.tsx             # parses keys, exports useProductBanner
  components/ProductPageBanner.tsx             # carousel (16:4, max 960px)
  components/ProductPageBanner.css
  pages/{Thiep,KhungAnh,Scrapbook,SetQuaTang,Khac,InAnh}Page.tsx
                                               # mount <ProductPageBanner page="…" />
                                               # as the FIRST child inside the hero <section>

admin-app/src/
  pages/ConfigPage.tsx                         # global slides + per-page override UI
  pages/ConfigPage.css
  services/api.ts                              # uploadApi.productBanner helper
```

## Admin UX

`/admin/config` gains two new cards:

1. **🖼️ Banner trang sản phẩm** — global on/off toggle + slide list. Each
   slide row shows a thumbnail (16:4), an optional link URL, ↑/↓ reorder,
   "Thay ảnh" (replace), and "Xoá" (delete). "+ Thêm slide" supports
   multi-file selection — uploading 5 files at once adds 5 slides.

2. **🎯 Ghi đè theo trang** — six rows (one per product page), each with
   three radio buttons (inherit / custom / disabled). Selecting **custom**
   reveals an inline slide editor identical to the global one but scoped to
   that page only.

### Orphan cleanup

- **On save**: any `imageUrl` that was in the DB on page load but no longer
  appears anywhere in the live state is sent to `uploadApi.deleteMany`.
- **On in-session removal/replace**: if the user uploads an image, then
  removes that slide before saving, the URL is purged immediately (because
  it isn't in the original snapshot). Switching a page's override away from
  `custom` purges any unsaved uploads in that override.
- Worst-case leak: upload + close tab without saving → orphan stays in S3.
  Acceptable; matches the `BannersPage` pattern.

## Mobile responsiveness

CSS in `ProductPageBanner.css` keeps the same 16:4 aspect on mobile and just
shrinks the border-radius / dot size. The hero's existing horizontal padding
gives the banner natural side insets.

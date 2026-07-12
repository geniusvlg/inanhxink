# Product Categories (common across product types)

Categories used to be scoped to a single product type (`product_categories.type`
was `NOT NULL`, e.g. a "Sinh nhật" category only ever showed up on the Thiệp
filter sidebar). They are now **common by default**: a category with
`type IS NULL` applies across every product type, while legacy typed rows keep
filtering to just their original page. The many-to-many link
(`product_category_map(product_id, category_id)`) was already type-agnostic, so
this was a filtering/display change, not a data-model rewrite.

On the storefront, categories now also drive an Instagram/TikTok-style
"story highlight" rail (`CategoryRail`), nested directly under the banner on
`HomePage` only, linking into a cross-type category grid (`CategoryDetailPage`).

Admins also control **which categories are visible** on the storefront
(`is_active`, default on) and can **upload a custom cover image** per category
(`image_url`), instead of every category always showing and its cover always
being auto-derived from the best-selling product's thumbnail.

---

## Database — `product_categories`

Migrations: `backend-golang/database/V59__common_product_categories.sql`,
`backend-golang/database/V60__product_category_visibility_and_image.sql`

| column | type | notes |
|--------|------|-------|
| `id`   | `SERIAL` PK | |
| `name` | `TEXT` NOT NULL | |
| `type` | `VARCHAR(20)` **nullable** | `NULL` = common to all product types. Non-null = legacy behavior, scoped to that one type. |
| `image_url` | `TEXT` nullable | Admin-uploaded cover image (raw S3 URL). `NULL` means "use the auto-derived cover" — see `cover_image_url` below. |
| `is_active` | `BOOLEAN` NOT NULL DEFAULT `TRUE` | Whether this category shows on the public storefront. Admin can still see/edit/re-enable inactive categories. |

```sql
ALTER TABLE product_categories ALTER COLUMN type DROP NOT NULL;

-- UNIQUE (name, type) from V16 doesn't stop duplicate common names, since
-- NULL is never equal to NULL. Close that gap separately.
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_categories_name_untyped
  ON product_categories (name) WHERE type IS NULL;
```

```sql
ALTER TABLE product_categories
  ADD COLUMN image_url TEXT,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
```

Existing typed categories are left untouched — nothing backfills their `type`
to `NULL`. New categories created from the admin without picking a type are
common by default.

**This is a deliberate choice, not a gap**: converting a pre-existing typed
category to common isn't a safe blanket `UPDATE`, because the same category
name may already exist as separate rows under multiple types (e.g. "Sinh nhật"
under both `thiep` and `khung_anh`) — making those common requires merging the
rows and re-pointing every `product_category_map` link to one survivor first,
which is a one-way data change. Rather than auto-merge silently, legacy
categories stay scoped, and can be consolidated manually through the admin UI
(delete the duplicate, re-tag its products onto one category) whenever an
admin wants to.

`product_category_map(product_id, category_id)` (both FKs `ON DELETE CASCADE`)
is unchanged — it never had a type column, so a common category can already be
attached to products of any type.

---

## Backend

### Public

| method | path | description |
|--------|------|-------------|
| `GET` | `/api/categories?type=&product_type=` | List **active** categories (`is_active = true`). `type` filters on the category's own `pc.type` scope column (strict equality — `type=thiep` returns only categories with `type = 'thiep'`, not common ones too); no current caller passes it. `product_type` is a different axis: it excludes categories with zero active, non-draft products of that product type (`EXISTS` against `product_category_map`/`products`), regardless of the category's own `type`. The storefront rail calls this with neither param (every active category, typed + common). The 5 per-type filter sidebars call it with `product_type=<page's type>` only, so a category only shows as a filter option when it actually has matching products on that page. Returns `{ success, categories: [{ id, name, cover_image_url, product_count }] }`, ordered by `name`. |
| `GET` | `/api/categories/{id}` | Single **active** category by id, same shape as one list row. Powers `CategoryDetailPage`. 404s if not found or inactive. |

`backend-golang/internal/handlers/categories.go` — `categoriesBaseQuery` ends
with `WHERE pc.is_active = true` and derives two computed fields per category:

- `cover_image_url` — the admin-uploaded `image_url` when set; otherwise
  falls back to a `LEFT JOIN LATERAL` picking the best-selling **active,
  non-draft** product in that category (`ORDER BY sold_count DESC, created_at
  DESC LIMIT 1`), preferring `thumbnail_url` and falling back to `images[0]`.
  `NULL` only when neither an admin image nor an eligible product exists.
- `product_count` — count of active, non-draft products linked via
  `product_category_map`, **across all product types** (not scoped by
  `product_type`, unlike the existence filter above — it's a raw total, not
  displayed in `ProductFilter.tsx`'s UI currently).

Both are CDN-rewritten at response time via `rewriteCategoryCoverCDN`
(`config.CdnStr`), per the storage rule in the repo's root `CLAUDE.md` — the DB
only ever stores the raw S3 URL, for both `image_url` and product thumbnails.

### Admin (all `RequireAdmin`)

| method | path | description |
|--------|------|-------------|
| `GET` | `/api/admin/product-categories?type=` | List categories (active + inactive), optionally filtered by type. Unfiltered list orders by `name` (no longer `type, name`, since type is no longer the primary grouping). |
| `POST` | `/api/admin/product-categories` | Body: `{ name, type? }`. Omitting `type` creates a common category. `image_url`/`is_active` aren't accepted here — new rows always start with `image_url = NULL`, `is_active = true` (DB defaults); set an image or hide it afterward via `PUT`. |
| `PUT` | `/api/admin/product-categories/:id` | Partial update. Only `image_url` and `is_active` are editable (`name`/`type` are rejected — silently dropped, not erred). 400 "No fields to update" if the body has neither. Replacing `image_url` deletes the previous S3 object (best-effort); sending `image_url: ""` clears it back to the auto-derived cover and also deletes the old S3 object. |
| `DELETE` | `/api/admin/product-categories/:id` | Also deletes the category's `image_url` from S3 (best-effort) if one was set. |

`backend-golang/internal/handlers/admin/product_categories.go`.

---

## Admin UI — `admin-app/src/pages/CategoriesPage.tsx`

- The create modal **no longer has a type `<select>`** — every new category is
  common unless created against legacy data directly in the DB.
- `typeLabel` renders **"Chung"** (Common) for `type == null`/`''`, otherwise
  the existing per-type Vietnamese label.
- Table column header changed from "Loại sản phẩm" to "Phạm vi" (scope), since
  a row can now read "Chung" instead of one specific product type.
- **"Ảnh" column** — per-row circular thumbnail (`resolveAssetUrl(image_url)`,
  `CategoriesPage.css`'s `.cat-thumb`) with a hidden file input + "Tải
  ảnh"/"Thay ảnh" button (`.btn-edit`), keyed per-category via a
  `Record<number, HTMLInputElement>` ref map — no edit modal. Uploads through
  `uploadApi.categoryImage()` (`POST /api/upload?prefix=categories`), then
  `productCategoriesApi.update(id, { image_url })`. Shows "—" when unset.
- **"Hiển thị" column** — shared `.cfg-toggle` pill switch (`Layout.css`, the
  same component `ConfigPage.tsx` uses), optimistically flips local state then
  calls `productCategoriesApi.update(id, { is_active })`; reverts (re-fetches)
  on failure. `toggleActive` handler itself is the same inline-toggle pattern
  as `BannersPage.tsx`, only the control markup is shared, not the handler.
- `admin-app/src/types/index.ts` — `ProductCategory.type` is now `type?: string`;
  also gained `image_url?: string | null` and `is_active: boolean`.
- `ProductItemsPage.tsx`'s category checkboxes call `productCategoriesApi.list()`
  with no type arg, so a product of any type can be tagged with any category
  (common or legacy-typed) — matches the many-to-many map, which never
  enforced type-matching anyway. This list is unfiltered by `is_active`
  (admin endpoint), so a product can still be tagged with a hidden category.

---

## Frontend (storefront) — `frontend-app/src`

### `CategoryRail` (`components/CategoryRail.tsx` + `.css`)

Instagram/TikTok-style circular "story highlight" rail. Fetches
`getCategories()` (no type filter — every category, common + legacy) once on
mount; renders nothing while loading and nothing at all if the list comes back
empty, so it never shows an empty rail. Each circle links to
`/danh-muc/{id}`; the label is the category name and the photo is
`cover_image_url` (falls back to the category name's first letter when null).
Shows at most `MAX_VISIBLE = 10` categories (`categories.slice(0, 10)`) — the
rest are still reachable via `/danh-muc/{id}` directly, just not surfaced in
the rail. Plain horizontal scroll (no nudge-arrow button — removed as visual
clutter); a right-edge fade hint (`.cat-rail-fade`) only renders when the rail
actually overflows (`ResizeObserver` comparing `scrollWidth`/`clientWidth` on
the scroll container, re-checked on resize), hidden on touch devices
(`@media (hover: none)`). It fades to `var(--cat-rail-fade-color, #fff)` —
plain white by default (invisible on the white/cream pages), overridden to
`var(--cute-cream)` by `HomePage.css` on `.homepage-banner-section` so it
blends with that section's gradient instead of leaving a stray white patch.

Mounted on `HomePage.tsx` only — no feature flag — nested *inside*
`homepage-banner-section`, directly under `<BannerCarousel />` (only when
`banners.length > 0`; falls back to a standalone mount in the same spot when
there's no banner), rather than after the full hero block — kept tight under
the banner instead of buried below the headline/CTA/polaroid collage. Nesting
it inside the section (rather than placing it as a sibling after) matters
because `homepage-banner-section`'s background is a purely horizontal gradient
with no vertical variation, so the rail inherits the exact same wash as the
banner image above it with zero extra styling — no seam. `homepage-hero`
still shares that same horizontal gradient directly (unchanged), so the whole
banner→rail→hero run reads as one continuous section.

Deliberately **not** mounted on `ThiepPage.tsx`, `KhungAnhPage.tsx`,
`ScrapbookPage.tsx`, `SetQuaTangPage.tsx`, `KhacPage.tsx`, or `InAnhPage.tsx` —
the rail was tried on all of these at one point (nested under each page's
banner, mirroring the HomePage placement) but was rolled back in favor of
showing it only on the home page; those pages' `ProductFilter` sidebar (see
below) remains the way to browse by category there.

The 5 pages with a `ProductFilter` sidebar (Thiệp, Khung Ảnh, Scrapbook, Set
Quà Tặng, Khác) fetch their sidebar's categories via
`getCategories(undefined, '<page's product type>')` — e.g. `ThiepPage.tsx`
calls `getCategories(undefined, 'thiep')`, matching the `type` string it
already passes to `getProducts({ type: 'thiep', ... })`. This scopes the
"Danh mục" checkbox list down to categories with at least one active,
non-draft product of that page's type, instead of listing every common +
legacy category regardless of whether it has any matching products (a
category can be typed for a *different* page, or just empty, and previously
still cluttered every sidebar). `CategoryRail` on `HomePage` deliberately
keeps calling `getCategories()` with no `product_type` — it's cross-type by
design, so it isn't scoped this way.

### `CategoryDetailPage` (`pages/CategoryDetailPage.tsx` + `.css`)

Route: `/danh-muc/:id` (registered in `App.tsx`, no `FlaggedRoute` wrapper —
same treatment as `/product/:id`, since it's only ever reached via the rail or
a direct link, never a nav entry).

- Fetches `getCategoryById(id)` (heading + count) and
  `getProducts({ category_ids: id, page, limit })` (paginated grid) in
  parallel.
- Results can span multiple product types (that's the point of a common
  category), so each card gets a small `.cd-type-chip` pill in the top-right
  corner of the thumbnail naming that product's type (local `TYPE_LABELS` map,
  same convention as `ProductDetailPage.tsx`'s `PRODUCT_LIST_CRUMB`) — positioned
  opposite the existing best-seller ribbon badge (top-left) so the two never
  collide.
- Back button calls `navigate(-1)` rather than linking to one fixed page —
  there is no single hub/grid page for all categories, so "back" has to return
  to whichever page the user tapped the rail from.
- Reuses `ProductSearchPage`'s classes via `@import './ProductSearchPage.css';`
  (`.ps-page`, `.ps-back`, `.ps-heading`, `.thiep-grid`, `.load-more-btn`, …)
  rather than redefining them, matching this codebase's existing convention of
  sharing page CSS through explicit `@import`.

### `services/api.ts`

```typescript
export interface Category {
  id: number;
  name: string;
  cover_image_url: string | null;
  product_count: number;
}

getCategories(type?: string, productType?: string): Promise<Category[]>   // GET /api/categories
getCategoryById(id: number | string): Promise<Category>  // GET /api/categories/{id}
```

---

## Files

```
backend-golang/
  database/V59__common_product_categories.sql
  database/V60__product_category_visibility_and_image.sql
  internal/handlers/categories.go              # public: ListCategories, GetCategory
  internal/handlers/admin/product_categories.go # admin CRUD + UpdateProductCategory
  cmd/server/main.go                            # GET /api/categories, /api/categories/{id}, PUT /api/admin/product-categories/{id}
admin-app/
  src/pages/CategoriesPage.tsx                  # no type select, "Chung" label, Ảnh + Hiển thị columns
  src/pages/CategoriesPage.css                  # .cat-thumb (toggle uses shared .cfg-toggle from Layout.css)
  src/pages/ProductItemsPage.tsx                 # category checkboxes: list() with no type
  src/types/index.ts                             # ProductCategory: type optional, + image_url, is_active
frontend-app/
  src/components/CategoryRail.tsx
  src/components/CategoryRail.css
  src/pages/CategoryDetailPage.tsx
  src/pages/CategoryDetailPage.css
  src/services/api.ts                            # Category type, getCategories, getCategoryById
  src/App.tsx                                     # /danh-muc/:id route
  src/pages/HomePage.tsx                          # <CategoryRail /> mount (only page that renders it)
docs/
  category-feature.md                            # this file
  admin-app.md                                    # admin API table + CategoriesPage note
```

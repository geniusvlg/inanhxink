# Homepage Banner & Featured Feedback

The homepage (`/home`) shows two admin-managed sections at the top of the page. It is reached via the **"Trang chủ"** nav entry and via the site logo (which links to `/home`). Visiting `/` still redirects to the first enabled category page (`/qr-yeu-thuong`, etc.) for backwards compatibility.

1. **Banner carousel** — admin-uploaded hero slides above the products grid.
2. **Featured Feedback** — testimonials marked `is_featured = true`, styled in the brand red `#e60022` (`rgb(230, 0, 34)`).

This doc covers the **banner** feature end-to-end. For the underlying testimonials feature (DB, admin UX, public `/danh-gia` page), see `docs/feedback-feature.md`.

---

## Database — `banners` table

Migration: `backend/database/V27__create_banners.sql`

| column      | type         | notes                                                                  |
|-------------|--------------|------------------------------------------------------------------------|
| `id`        | `SERIAL` PK  |                                                                        |
| `image_url` | `TEXT` NOT NULL | Public S3 URL                                                       |
| `link_url`  | `TEXT` nullable | Click-through. Internal paths (`/thiep`) become `<Link>`, others `<a target="_blank">` |
| `alt_text`  | `TEXT` nullable | Accessibility / SEO                                                 |
| `is_active` | `BOOLEAN` NOT NULL DEFAULT `TRUE` | Hide without deleting                              |
| `sort_order`| `INTEGER` NOT NULL DEFAULT `0` | Ascending — lowest displays first                     |
| `created_at`/`updated_at` | `TIMESTAMPTZ` | `updated_at` auto-bumped via trigger `trg_banners_updated_at` |

Index: `idx_banners_display (is_active, sort_order ASC, created_at DESC)` — matches the public query.

---

## Backend

### Public

| method | path | description |
|--------|------|-------------|
| `GET`  | `/api/banners` | Returns `{ success, banners: [{ id, image_url, link_url, alt_text }] }` filtered to `is_active = TRUE`, ordered by `sort_order ASC, created_at DESC` |

`backend/routes/banners.ts` — single, simple read.

### Admin (all `requireAdmin`)

| method | path | description |
|--------|------|-------------|
| `GET`    | `/api/admin/banners` | Full rows |
| `POST`   | `/api/admin/banners` | Body: `{ image_url, link_url?, alt_text?, is_active? }` — auto-assigns next `sort_order` |
| `PUT`    | `/api/admin/banners/:id` | Partial update. If `image_url` changes, the **old** S3 object is deleted after the row is updated |
| `PATCH`  | `/api/admin/banners/reorder` | Body: `{ items: [{ id, sort_order }, …] }` — transactional |
| `DELETE` | `/api/admin/banners/:id` | Removes the row and the S3 image (best-effort) |

`backend/routes/admin/banners.ts` — uses `deleteFromS3` (`backend/config/s3.ts`) for cleanup.

### S3 layout

```
s3://<bucket>/banners/
└── {timestamp}-{randomString}.webp
```

Same upload pipeline as everything else: `POST /api/upload?prefix=banners` → Multer → Sharp → WebP 90% → S3.

### S3 orphan handling

| scenario | cleanup path |
|----------|--------------|
| Admin uploads in the modal, then cancels/closes it | `DELETE /api/admin/uploads` (fire-and-forget from the page) |
| Admin uploads twice in the same modal session (re-pick) | Previous unsaved upload purged via `DELETE /api/admin/uploads` |
| Admin replaces image and saves | Server-side: `PUT /:id` deletes the previous `image_url` from S3 |
| Admin deletes a banner | Server-side: `DELETE /:id` removes the S3 object |

The same `deleteFromS3` helper is used for testimonials (consistency).

---

## Admin UI — `admin-app/src/pages/BannersPage.tsx`

- **Sidebar entry**: `🖼️ Banner` (route `/banners`)
- **Table columns**: thumbnail (clickable, opens full image), link, alt, visibility toggle (`✅` / `🚫`), reorder arrows, edit / delete.
- **Add / Edit modal**: one-file image picker (S3-first), link, alt, visibility checkbox.
  - Hint: "Khuyến nghị: ảnh tỷ lệ 16:6 (vd 1600×600), < 1 MB."
- All copy is **Vietnamese** (matches the rest of the admin app).

---

## Frontend — `frontend-app`

### `BannerCarousel.tsx`

- Auto-rotates every **5 s**, pauses on `mouseenter`.
- Hover-revealed prev/next arrows + always-visible dots.
- Internal paths render as `<Link>` (no full reload), external URLs as `<a target="_blank" rel="noopener noreferrer">`.
- 16:6 aspect ratio on desktop, 16:9 on `≤ 720px`.

### `FeaturedFeedback.tsx`

- Pulls from `getTestimonials()` (already loaded by `HomePage`), filters `is_featured`. If no featured rows exist, falls back to the most recent testimonials so the section is never empty when there's data.
- Limit defaults to 6 cards in a 3-column grid (2 cols ≤ 900 px, 1 col ≤ 560 px).
- Each card opens a lightbox.
- CTA: "Xem tất cả đánh giá →" links to `/danh-gia`.

### Brand color

The Featured Feedback section uses **`#e60022`** (`rgb(230, 0, 34)`) as its accent. CSS variables defined locally in `FeaturedFeedback.css`:

```css
--ff-accent:      #e60022;
--ff-accent-soft: rgba(230, 0, 34, 0.08);  /* top vertical wash */
--ff-accent-tint: rgba(230, 0, 34, 0.18);  /* radial blushes + borders */
--ff-accent-deep: #b5001a;                 /* hover state for the CTA */
```

### `HomePage.tsx` composition (mounted at `/home`)

```
<SiteHeader activePage="home" />
{banners.length > 0 ? <BannerCarousel /> : <hero fallback>}
<homepage-products />
<FeaturedFeedback />
<SiteFooter />
```

Fetches templates / banners / testimonials in parallel; only the templates fetch surfaces an error to the UI — banner/feedback failures silently render empty (graceful degradation).

### Routing (`frontend-app/src/App.tsx`)

| path     | element |
|----------|---------|
| `/`      | `<HomeRedirect />` — redirects to the first feature-flag-enabled category page (legacy behaviour). Falls back to `/home` if every flag is off. |
| `/home`  | `<HomePage />` — the new homepage with banner + featured feedback. |

The site logo (desktop + mobile drawer) links to `/home`, and the nav has a leading **"Trang chủ"** link that highlights when `activePage="home"`.

---

## Files

```
backend/
  database/V27__create_banners.sql
  routes/banners.ts                 # public
  routes/admin/banners.ts           # admin CRUD + reorder + S3 cleanup
admin-app/
  src/pages/BannersPage.tsx
  src/pages/BannersPage.css
  src/services/api.ts               # bannersApi + uploadApi.banners
  src/types/index.ts                # Banner interface
  src/App.tsx                       # /banners route
  src/components/Layout.tsx         # 🖼️ Banner nav link
frontend-app/
  src/components/BannerCarousel.tsx
  src/components/BannerCarousel.css
  src/components/FeaturedFeedback.tsx
  src/components/FeaturedFeedback.css
  src/services/api.ts               # getBanners + Banner type
  src/pages/HomePage.tsx            # composition
  src/pages/HomePage.css            # banner section wrapper
docs/
  banner-feature.md                 # this file
  admin-app.md                      # banners admin section + API table
```

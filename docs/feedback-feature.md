# Feedback (Testimonials) Feature

End-to-end feature for collecting and displaying customer review screenshots imported from external platforms (TikTok, Zalo, Instagram, Other).

Spans backend (DB + API), admin app (CRUD UI), and the public-facing customer site.

## User-facing surfaces

| Surface | Path | Audience |
|---|---|---|
| Public listing | `inanhxink.com/danh-gia` | Customers — masonry gallery of all testimonials |
| Header nav link | "Feedback" (visible on every public page) | Customers |
| Admin management | `admin.inanhxink.com/testimonials` (sidebar: "💬 Feedback") | Internal |

## Data model

### Table: `testimonials` (migration `V26__create_testimonials.sql`)

| Column | Type | Notes |
|---|---|---|
| `id` | `SERIAL` PK | |
| `image_url` | `TEXT NOT NULL` | Full S3 (CDN-rewritable) URL of the WebP screenshot |
| `platform` | `TEXT NOT NULL DEFAULT 'other'` | One of: `tiktok`, `zalo`, `instagram`, `other` (whitelisted in API). `other` is the bulk-upload default and the fallback for unknown values |
| `reviewer_name` | `TEXT` (nullable) | Optional display name |
| `caption` | `TEXT` (nullable) | Optional quoted caption / excerpt |
| `is_featured` | `BOOLEAN NOT NULL DEFAULT FALSE` | Featured rows surface first |
| `sort_order` | `INTEGER NOT NULL DEFAULT 0` | Manual ordering (admin uses ↑/↓) |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Auto-updated by trigger `trg_testimonials_updated_at` |

Index `idx_testimonials_display` on `(is_featured DESC, sort_order ASC, created_at DESC)` matches the public/admin list query exactly.

## S3 storage

```
s3://inanhxink-{env}/testimonials/
└── {timestamp}-{randomString}.webp
```

Uploaded via the shared `POST /api/upload?prefix=testimonials` endpoint, which:

1. Accepts up to 20 files via Multer (10 MB each)
2. Converts each to WebP (90% quality) via Sharp
3. Uploads to S3 with `ACL: public-read`
4. Returns the public URLs

No watermark is applied for testimonials (they're already external screenshots).

## API

### Public

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/testimonials` | Returns `{ success, testimonials: [{id, image_url, platform, reviewer_name, caption, is_featured}] }` ordered by `is_featured DESC, sort_order ASC, created_at DESC` |

### Admin (JWT-protected via `requireAdmin`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/testimonials` | Full list (includes `sort_order`, timestamps) |
| POST | `/api/admin/testimonials` | Create one — body `{ image_url, platform?, reviewer_name?, caption?, is_featured? }` |
| POST | `/api/admin/testimonials/bulk` | Atomic multi-insert. Body (preferred) `{ items: [{ image_url, platform?, reviewer_name?, caption?, is_featured? }] }`. Legacy `{ image_urls: string[] }` still accepted (defaults each row to `platform='other'`). Sequential `sort_order` is auto-assigned |
| PUT | `/api/admin/testimonials/:id` | Partial update of any of the above fields |
| PATCH | `/api/admin/testimonials/reorder` | Body `{ items: [{id, sort_order}] }` — bulk-updates `sort_order` in a transaction |
| DELETE | `/api/admin/testimonials/:id` | Hard delete — also best-effort deletes the `image_url` from S3 |
| DELETE | `/api/admin/uploads` | Body `{ urls: string[] }` — best-effort orphan cleanup (used by the admin UI on cancel/replace) |

`platform` is whitelisted server-side; unknown values are coerced to `'other'`.

## Code locations

### Backend

| File | Role |
|---|---|
| `backend/database/V26__create_testimonials.sql` | Migration — table, index, `updated_at` trigger |
| `backend/routes/testimonials.ts` | Public route (`GET /api/testimonials`) |
| `backend/routes/admin/testimonials.ts` | Admin CRUD + `/bulk` + `/reorder` |
| `backend/server.ts` | Registers both routers |

### Admin app

| File | Role |
|---|---|
| `admin-app/src/pages/TestimonialsPage.tsx` | Page component — table, edit modal, reorder, bulk upload |
| `admin-app/src/pages/TestimonialsPage.css` | Page-specific styling (thumbnail, platform badge, etc.) |
| `admin-app/src/services/api.ts` | `testimonialsApi` + `uploadApi.testimonials()` |
| `admin-app/src/types/index.ts` | `Testimonial`, `TestimonialPlatform` |
| `admin-app/src/App.tsx` | Route `/testimonials` |
| `admin-app/src/components/Layout.tsx` | Sidebar nav entry "💬 Feedback" |

### Customer site

| File | Role |
|---|---|
| `frontend-app/src/pages/TestimonialsPage.tsx` | Page at `/danh-gia` — hero + masonry + lightbox |
| `frontend-app/src/pages/TestimonialsPage.css` | Pure-CSS columns masonry, platform badges, lightbox |
| `frontend-app/src/services/api.ts` | `getTestimonials()` + `Testimonial` / `TestimonialPlatform` types |
| `frontend-app/src/App.tsx` | Route `/danh-gia` (no feature flag — always available) |
| `frontend-app/src/components/SiteHeader.tsx` | Nav link "Feedback", `activePage='danh-gia'` |

## Public page UX (`/danh-gia`)

- **Hero**: title "Khách hàng nghĩ gì về tụi mình" + subtitle
- **Masonry**: pure-CSS `column-count` (4 cols ≥ 1100px → 3 cols 740–1099px → 2 cols < 740px) with `break-inside: avoid` so each card stays in one column. Images render at natural aspect ratio (no cropping).
- **Card overlay**: platform badge top-left (brand-coloured: TikTok=black, Zalo=blue `#0068ff`, Instagram=gradient, Other=grey), ⭐ badge top-right for featured.
- **Optional meta** below the image: `reviewer_name` + `caption`.
- **Lightbox**: clicking a card opens a full-screen modal; closes on backdrop click, close button, or `Escape` key.
- **Empty state**: "Chưa có đánh giá nào — quay lại sau nhé!"

## Admin UX (`/admin/testimonials`)

- **Bulk upload (two-step)**:
  1. "+ Tải lên ảnh đánh giá" → multi-file picker → all files upload to S3.
  2. A **Review modal** opens with one row per uploaded image. Each row exposes the platform dropdown, reviewer name, caption, ⭐ featured toggle, and a "Bỏ ảnh này" remove button. "Lưu tất cả" sends the configured items in a single atomic `POST /bulk`.
  3. "Huỷ tất cả" discards the pending list (S3 files become orphans — no DB row is created).
- Table: thumbnail, platform badge, reviewer, caption, featured ⭐ toggle, ↑ / ↓ sort buttons, Sửa / Xoá.
- Edit modal: replace image (re-uploads via the same endpoint), select platform, set reviewer name, caption, featured.

### S3 orphan handling

The admin UI auto-cleans S3 in every path that would otherwise leave a dangling object:

| Action | What gets purged |
|---|---|
| Review modal — "Bỏ ảnh này" | The single removed image |
| Review modal — "Huỷ tất cả" | All pending images |
| Edit modal — "Thay ảnh" twice without saving | The previous (intermediate) replacement |
| Edit modal — "Lưu" after replacing image | The original `image_url` from before the edit |
| Edit modal — close/cancel after replacing | The newly uploaded replacement |
| `DELETE /api/admin/testimonials/:id` | The deleted row's `image_url` |

All deletes are best-effort: failures are logged but never block the UI. Cleanup is performed via `DELETE /api/admin/uploads` (`uploadApi.deleteMany([...])` on the client), backed by `deleteFromS3(url)` in `backend/config/s3.ts`. Only objects under the configured bucket are touched — `extractKeyFromUrl` returns `null` for any URL outside `${S3_ENDPOINT}/${S3_BUCKET}/`.

## Adding a new platform

1. Add the value to `ALLOWED_PLATFORMS` (Set) in `backend/routes/admin/testimonials.ts`
2. Add to the `TestimonialPlatform` union in:
   - `admin-app/src/types/index.ts`
   - `frontend-app/src/services/api.ts`
3. Add a label entry in `PLATFORMS` (admin) and `PLATFORM_LABEL` (public page)
4. Add a `.platform-{name}` colour class in `frontend-app/src/pages/TestimonialsPage.css`

No DB migration needed — `platform` is a free-text column whitelisted at the API layer.

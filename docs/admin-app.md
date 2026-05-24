# Admin App

## Overview

The admin app (`admin-app/`) is a React SPA (Vite + TypeScript) for managing products, QR templates, categories, orders, vouchers, and customer feedback.

## Directory Structure

```
admin-app/src/
├── pages/
│   ├── ProductItemsPage.tsx   # Product CRUD (shared by all product types)
│   ├── FulfillmentPage.tsx    # Paid product + QR keychain fulfillment workflow
│   ├── ThiepPage.tsx          # type=thiep
│   ├── KhungAnhPage.tsx       # type=khung_anh
│   ├── InAnhPage.tsx          # type=in_anh
│   ├── ScrapbookPage.tsx      # type=so_scrapbook
│   ├── SetQuaTangPage.tsx     # type=set-qua-tang
│   ├── KhacPage.tsx           # type=khac
│   ├── ProductsPage.tsx       # QR templates management
│   ├── CategoriesPage.tsx     # Product categories
│   ├── TestimonialsPage.tsx   # Customer feedback (screenshots from external platforms)
│   ├── BannersPage.tsx        # Homepage hero banner slides
│   └── LoginPage.tsx          # JWT auth
├── services/
│   └── api.ts                 # Axios client + JWT interceptors
├── types/
│   └── index.ts               # TypeScript interfaces
└── contexts/
    └── AuthContext.tsx        # Auth state
```

## Authentication

- JWT token stored in `localStorage.admin_token`
- All admin API calls attach `Authorization: Bearer {token}`
- 401 response → redirect to login

## Product Types

| Page | type value |
|------|-----------|
| Thiep | `thiep` |
| Khung Anh | `khung_anh` |
| In Anh | `in_anh` |
| Scrapbook | `so_scrapbook` |
| Set Qua Tang | `set-qua-tang` |
| Khac | `khac` |

All types share `ProductItemsPage.tsx` with a `type` prop. The `products.type`
column is `VARCHAR(20)` with no CHECK constraint, so adding a new product
category only requires (1) a new admin wrapper page + sidebar entry, (2) a new
public-facing page on the storefront, and (3) updating `ProductItemsPage`'s
`type` union + `PAGE_TITLE` map.

Admin image previews use `admin-app/src/utils/assetUrl.ts` to render S3-backed
assets through the CDN when configured. The underlying admin API values remain
raw S3 URLs for edit/delete flows.

> Note: `/qr-yeu-thuong` on the storefront is **not** a product category. It
> is the listing of QR-website templates (`templates` table — Galaxy, Love
> Letter, etc.) and is managed under the `🔳 QR Templates` sidebar entry.

## Product Fields

```typescript
{
  name: string;
  description?: string;
  price: number;
  images: string[];           // array of S3 URLs (JSONB in DB)
  thumbnail_url?: string | null; // explicit product card thumbnail; falls back to images[0]
  type: string;
  is_active: boolean;
  is_best_seller: boolean;
  watermark_enabled: boolean;
  tiktok_url?: string;
  instagram_url?: string;
  category_ids?: number[];
  discount_price?: number;
  discount_from?: string;     // ISO timestamp
  discount_to?: string;       // ISO timestamp
  max_upload_images: number;  // per-product customer upload limit, default 15
}
```

`max_upload_images` controls how many customer images can be uploaded for that
product during checkout. The admin product form defaults it to `15`; checkout
also refreshes product metadata by ID so existing cart items pick up changes.

## Image Upload Flow

### Edit (existing product)
1. User selects new files → local preview via object URL
2. On save: upload pending files via `POST /api/upload?prefix=products/{type}/product-{id}`
3. Optional thumbnail upload uses `POST /api/upload?prefix=products/{type}/product-{id}/thumbnail`
4. Combine saved URLs + new uploaded URLs
5. `PUT /api/admin/products/:id` with all URLs and optional `thumbnail_url`

### Create (new product) — current pattern
1. `POST /api/admin/products` with `is_active: false`, no images → get `id`
2. Upload files via `POST /api/upload?prefix=products/{type}/product-{id}`
3. Optional thumbnail upload uses the same product ID under `products/{type}/product-{id}/thumbnail`
4. `PUT /api/admin/products/:id` with `is_active: true` + image URLs and optional `thumbnail_url`
5. Rollback: delete product if upload fails

### Planned improvement — S3-first (Option 1: temp folder)
- Generate a `temp-{uuid}` key client-side before product exists
- Upload images to `products/{type}/temp-{uuid}/`
- Create product with those URLs already set
- No DB orphan risk, no rollback needed
- Folder name won't be `product-{id}` but URLs are what matter

## API Endpoints (Admin)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/products?type=&page=&limit=` | List products |
| GET | `/api/admin/products/:id` | Get product |
| POST | `/api/admin/products` | Create product |
| PUT | `/api/admin/products/:id` | Update product |
| DELETE | `/api/admin/products/:id` | Delete product |
| GET | `/api/admin/product-categories?type=` | List categories |
| POST | `/api/admin/product-categories` | Create category |
| DELETE | `/api/admin/product-categories/:id` | Delete category |
| GET | `/api/admin/testimonials` | List all testimonials |
| POST | `/api/admin/testimonials` | Create testimonial (single) |
| POST | `/api/admin/testimonials/bulk` | Create many from `image_urls[]` (used after bulk upload) |
| PUT | `/api/admin/testimonials/:id` | Update testimonial |
| PATCH | `/api/admin/testimonials/reorder` | Bulk update `sort_order` for `[{id, sort_order}]` |
| DELETE | `/api/admin/testimonials/:id` | Delete testimonial (also removes the S3 image) |
| GET | `/api/admin/banners` | List all banners (admin) |
| POST | `/api/admin/banners` | Create banner (`image_url`, `link_url?`, `alt_text?`, `is_active?`) |
| PUT | `/api/admin/banners/:id` | Update banner; replaced image is purged from S3 |
| PATCH | `/api/admin/banners/reorder` | Bulk-update `sort_order` for `[{id, sort_order}]` |
| DELETE | `/api/admin/banners/:id` | Delete banner (also removes the S3 image) |
| DELETE | `/api/admin/uploads` | Body `{ urls: string[] }` — orphan-cleanup for cancelled/replaced uploads |
| POST | `/api/upload?prefix=templates/{template_type}` | Upload QR template thumbnails to S3 |
| POST | `/api/upload?prefix=products/{folder}` | Upload images to S3 |
| POST | `/api/upload?prefix=testimonials` | Upload testimonial screenshots to S3 |
| POST | `/api/upload?prefix=banners` | Upload banner images to S3 |
| GET | `/api/admin/product-orders/fulfillment?fulfillment_status=` | Paid product + QR keychain fulfillment board |
| PATCH | `/api/admin/product-orders/:id/items` | Admin edits product order images/notes and customer phone/address |
| GET | `/api/admin/orders/search?code=` | Admin searches paid fulfillment orders by invoice/QR code, customer name, or phone |

Fulfillment shipping step requires both `tracking_code` and `shipping_carrier`
when moving product or QR-keychain orders to `shipped`.

## Page Visibility And Order

`ConfigPage.tsx` manages storefront page visibility and menu ordering through
metadata keys:

- `page_order_tracking`: toggles the customer order lookup page.
- `page_danh_gia`: toggles the storefront feedback/reviews page.
- `page_order`: JSON array of page flag keys that controls storefront nav order
  after `Trang chủ`.

`ConfigPage.tsx` also manages the global product checkout shipping rule:

- `product_shipping_fee_threshold`: order subtotal required for free shipping.
- `product_shipping_fee_below_threshold`: shipping fee when subtotal is below
  the threshold.

Both default to `0`, which means no shipping fee is applied until admin sets the
rule.

## S3 Folder Structure (Products)

```
s3://inanhxink-prod/products/
├── thiep/product-{id}/
├── khung_anh/product-{id}/
├── in_anh/product-{id}/
├── so_scrapbook/product-{id}/
├── khac/product-{id}/
└── set-qua-tang/product-{id}/
```

Product catalog image naming: `{timestamp}-{randomString}.webp` (converted to WebP 90%).

Product-order customer uploads are different: files under `product-orders/` keep
the original format and bytes for print quality. See
`docs/product-orders-fulfillment.md`.

## Image Processing

- Product catalog uploads are converted to **WebP** (90% quality)
- Product-order customer uploads under `product-orders/` keep the original file
  bytes and format for printing
- Optional watermark (`watermark=true` query param):
  - File: `backend/public/watermark.png` for Node.js backend and `backend-golang/public/watermark.png` for Go backend
  - Position: bottom-right, 30% of image width, 3% margin

## Feedback (Testimonials)

`TestimonialsPage.tsx` — manages customer review screenshots imported from external platforms (TikTok, Shopee, Facebook, Instagram, Lazada, Other).

- **Bulk upload**: single button uploads multiple screenshots, creates one `testimonials` row per file with default metadata (`platform = 'other'`, sequential `sort_order`).
- **Edit**: per-row modal — replace image, set platform, reviewer name, caption, featured flag.
- **Reorder**: `↑ / ↓` buttons swap `sort_order` with neighbour; persisted via `PATCH /reorder`.
- **Featured (`⭐`)**: surfaces the row first on the public `/danh-gia` page.
- **Public side**: see `docs/feedback-feature.md` for the full feature (DB schema, public page, S3 layout).

## Banners (homepage hero)

`BannersPage.tsx` — admin-managed slides for the homepage carousel.

- **Fields**: `image_url` (required), `link_url` (optional click-through, internal `/path` or external `https://…`), `alt_text` (optional), `is_active` (toggle), `sort_order`.
- **Add**: modal with one-file upload (S3-first); image goes to `s3://…/banners/`. If the modal is dismissed without saving, the upload is purged via `DELETE /api/admin/uploads` (no orphans).
- **Edit**: same modal — replacing the image purges the previous file server-side after the `PUT` succeeds.
- **Reorder**: `↑ / ↓` arrows swap `sort_order` with the neighbour; persisted via `PATCH /reorder`.
- **Toggle visibility**: `✅ / 🚫` button calls `PUT { is_active }` without opening the modal.
- **Delete**: removes the row and the S3 image (best-effort).
- **Public side**: `BannerCarousel.tsx` (auto-rotates every 5 s, pauses on hover, arrows + dots); see `docs/banner-feature.md`.

# Admin App

## Overview

The admin app (`admin-app/`) is a React SPA (Vite + TypeScript) for managing products, QR templates, categories, orders, and vouchers.

## Directory Structure

```
admin-app/src/
├── pages/
│   ├── ProductItemsPage.tsx   # Product CRUD (shared by all product types)
│   ├── ThiepPage.tsx          # type=thiep
│   ├── KhungAnhPage.tsx       # type=khung_anh
│   ├── InAnhPage.tsx          # type=in_anh
│   ├── ScrapbookPage.tsx      # type=so_scrapbook
│   ├── SetQuaTangPage.tsx     # type=set-qua-tang
│   ├── KhacPage.tsx           # type=khac
│   ├── ProductsPage.tsx       # QR templates management
│   ├── CategoriesPage.tsx     # Product categories
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

All types share `ProductItemsPage.tsx` with a `type` prop.

## Product Fields

```typescript
{
  name: string;
  description?: string;
  price: number;
  images: string[];           // array of S3 URLs (JSONB in DB)
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
}
```

## Image Upload Flow

### Edit (existing product)
1. User selects new files → local preview via object URL
2. On save: upload pending files via `POST /api/upload?prefix=products/{type}/product-{id}`
3. Combine saved URLs + new uploaded URLs
4. `PUT /api/admin/products/:id` with all URLs

### Create (new product) — current pattern
1. `POST /api/admin/products` with `is_active: false`, no images → get `id`
2. Upload files via `POST /api/upload?prefix=products/{type}/product-{id}`
3. `PUT /api/admin/products/:id` with `is_active: true` + image URLs
4. Rollback: delete product if upload fails

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
| POST | `/api/upload?prefix=products/{folder}` | Upload images to S3 |

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

File naming: `{timestamp}-{randomString}.webp` (all images converted to WebP 90%)

## Image Processing

- All uploads converted to **WebP** (90% quality) via Sharp
- Optional watermark (`watermark=true` query param):
  - File: `backend/public/watermark.png`
  - Position: bottom-right, 30% of image width, 3% margin

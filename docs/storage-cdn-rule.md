# Storage rule — S3 ↔ CDN

This is a **mandatory** project-wide convention for handling URLs of any
static asset (images, audio, PDFs, etc.) stored in our object storage.

## TL;DR

1. **Database stores raw S3 URLs** — always.
2. **Public APIs serve CDN URLs** — always.
3. **Admin APIs serve raw S3 URLs** — always. Admin UI previews may rewrite to CDN for display only, but must keep raw S3 URLs in state and API payloads.

The rewrite happens **at response time** in public routes; it is never
persisted, never reversed, never branched on.

## Why

| Surface          | What it sees       | Why                                                     |
| ---------------- | ------------------ | ------------------------------------------------------- |
| DB (`*.image_url`) | Raw S3 URL         | Canonical pointer to the bucket object. Used by deletes (`deleteFromS3` parses the bucket key out of it) and verification tooling. |
| Public client    | CDN URL            | Cheap bandwidth, edge caching, friendly domain.         |
| Admin API/client state | Raw S3 URL         | Admins need to verify objects exist in the bucket and trigger deletes. |
| Admin image previews | CDN URL when configured | Preview thumbnails can use cached CDN delivery without changing saved values. |

If we stored CDN URLs we'd:

- break `deleteFromS3` (it expects the S3 origin)
- couple every DB row to one CDN deployment (changing CDN means a migration)
- need a reverse rewrite in admin tools

## How

The single source of truth is `backend/config/cdn.ts`. It exposes:

| Helper                                | When to use                                           |
| ------------------------------------- | ----------------------------------------------------- |
| `rewriteS3ToCdn(unknown) → unknown`   | Generic — used by template injection (mixed types).   |
| `cdnUrl(string \| null) → string \| null` | One scalar URL field on a single row.             |
| `cdnUrlArray(unknown) → string[]`     | A JSONB array of URLs (e.g. `products.images`).       |
| `rewriteRowImageFields(row, { url, array })` | A row with one or more image columns; preferred for `result.rows.map(...)` patterns. |

Behaviour: if `CDN_BASE_URL` is unset (typical in local dev), URLs pass
through unchanged so dev still works against raw S3.

## Where the rewrite is applied today

Public routes (`backend/routes/*.ts`):

- `banners.ts` → `image_url`
- `heroShots.ts` → `image_url`
- `products.ts` → `images` (JSONB array) and `thumbnail_url` — applied in `/`, `/featured-on-home`, `/:id`; `thumbnail_url` falls back to `images[0]` at response time when null.
- `templates.ts` → `image_url` — applied in `/` and `/:id`
- `qrcodes.ts` → `template.imageUrl`
- `testimonials.ts` → `image_url`

Server-level helpers (`backend/server.ts`):

- `injectScripts()` — rewrites `musicUrl`, `imageUrls`, `avatarFrom`,
  `avatarTo` before injecting into rendered template HTML.
- `GET /api/site-data` — rewrites `musicUrl` and `imageUrls` in
  `template_data` JSONB before returning it.

Admin routes (`backend/routes/admin/*.ts`): **DO NOT REWRITE**. Admin pages
upload, list, edit, and delete using the raw S3 URLs. If an admin page needs an
`<img>` preview, rewrite only the rendered `src` with the admin app's asset URL
helper; do not mutate form values or persisted payloads.

## Product-order image prefixes

Product order uploads are used for printing and handcrafted fulfillment:

| Prefix | Meaning | Lifecycle |
|--------|---------|-----------|
| `product-orders/temp/{cart_session_id}/` | Customer uploaded images before payment | expire after 1 day |
| `product-orders/paid/{order_id}/` | Images moved after payment confirmation | expire after 7 days |

Unlike product catalog images, product-order customer uploads keep their original
file bytes and format. They are not converted to WebP.

The database still stores raw S3 URLs. Public/admin previews may rewrite URLs to
CDN only for rendering. Admin fulfillment can download images from CDN-resolved
URLs while keeping DB state as raw S3 URLs.

## Adding a new public endpoint

When you add a public route that returns image fields:

1. `import { rewriteRowImageFields } from '../config/cdn';`
2. Map every returned row through it before sending the response:

   ```ts
   const rows = result.rows.map(r =>
     rewriteRowImageFields(r, { url: ['image_url'], array: ['extra_images'] })
   );
   return res.json({ success: true, items: rows });
   ```

3. Test with `CDN_BASE_URL=https://cdn.inanhxink.com/inanhxink-prod`
   set: the response should contain `cdn.inanhxink.com`, not the S3
   endpoint.

## Configuration

Set in `docker-compose.yml` and CI:

```env
S3_ENDPOINT=https://s3.<region>.<provider>
S3_BUCKET=inanhxink-prod
CDN_BASE_URL=https://cdn.inanhxink.com/inanhxink-prod
```

The rewrite key is **prefix match**: any URL starting with
`${S3_ENDPOINT}/${S3_BUCKET}` is rewritten to `${CDN_BASE_URL}` plus
whatever comes after the bucket name.

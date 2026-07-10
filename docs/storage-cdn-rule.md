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
| DB (`*.image_url`) | Raw S3 URL         | Canonical pointer to the bucket object. Used by deletes (`DeleteFromS3` in `backend-golang/internal/config/s3.go` parses the bucket key out of it) and verification tooling. |
| Public client    | CDN URL            | Cheap bandwidth, edge caching, friendly domain.         |
| Admin API/client state | Raw S3 URL         | Admins need to verify objects exist in the bucket and trigger deletes. |
| Admin image previews | CDN URL when configured | Preview thumbnails can use cached CDN delivery without changing saved values. |

If we stored CDN URLs we'd:

- break `DeleteFromS3` (it expects the S3 origin)
- couple every DB row to one CDN deployment (changing CDN means a migration)
- need a reverse rewrite in admin tools

## How

The single source of truth is `backend-golang/internal/config/cdn.go`. It exposes:

| Helper                                       | When to use                                                          |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `RewriteS3ToCdn(url any) any`                 | Generic — used when mapping over slices of mixed types.              |
| `CdnStr(url string) string`                   | One scalar URL value (e.g. a single map/struct field).                |
| `CdnURLField(row map[string]any, field string)` | Rewrites one string field of a row map **in place**.                |
| `CdnArrayField(row map[string]any, field string)` | Rewrites every string element of a `[]any` field of a row map **in place**. |

Behaviour: if `CDN_BASE_URL` is unset (typical in local dev), URLs pass
through unchanged so dev still works against raw S3. The rewrite is a
**prefix match** on `${S3_ENDPOINT}/${S3_BUCKET}` (see Configuration below),
implemented once in `CdnStr` — every other helper delegates to it.

There is no single combined "rewrite this row's image fields" helper (no Go
equivalent of the old `rewriteRowImageFields`) — call `CdnURLField`/`CdnArrayField`
once per field, or loop manually like `rewriteTemplateDataCDN` does (see below).

## Where the rewrite is applied today

Public handlers (`backend-golang/internal/handlers/*.go`):

- `banners.go` → `image_url` (`CdnURLField`)
- `heroshots.go` → `image_url` (`CdnURLField`)
- `products.go` → `thumbnail_url` (`CdnURLField`) and `images` (`CdnArrayField`) on product list/detail rows; `variants[].image` per-variant image (`CdnStr`)
- `templates.go` → `image_url` (`CdnURLField`) — applied on both the list and single-template responses
- `qrcodes.go` → `template_image_url` (`CdnStr`)
- `testimonials.go` → `image_url` (`CdnURLField`) — applied on both the list and single-testimonial responses
- `metadata.go` → banner/config slide `imageUrl` fields, `in_anh_price_image_url`, and generic string-array config values (`CdnStr`, looped per entry)
- `orders.go` → order item `ImageURLs[]` in order detail/confirmation responses (`CdnStr`, looped per entry)

Shared template-data rewrite (`sitedata.go`'s `rewriteTemplateDataCDN(data map[string]any)`),
used by both:
- `SiteData` handler (`GET /api/site-data`, `sitedata.go`)
- `ServeTemplate`'s `injectScripts()` (`templateserve.go`) — rewrites before injecting `window.dataFromSubdomain` into the served template HTML

It rewrites the scalar fields `musicUrl`, `avatarFrom`, `avatarTo`, `boyImage`,
`girlImage`, and the array fields `imageUrls`, `popupImages` inside `template_data`.

Admin handlers (`backend-golang/internal/handlers/admin/*.go`): **DO NOT REWRITE**.
Admin pages upload, list, edit, and delete using the raw S3 URLs. If an admin page
needs an `<img>` preview, rewrite only the rendered `src` with the admin app's asset
URL helper (`admin-app/src/utils/assetUrl.ts`); do not mutate form values or persisted
payloads.

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

When you add a public handler that returns image fields:

1. Import `"inanhxink/backend-golang/internal/config"`.
2. Rewrite every image field on each row before sending the response:

   ```go
   for _, row := range rows {
       config.CdnURLField(row, "image_url")
       config.CdnArrayField(row, "extra_images")
   }
   JSON(w, 200, map[string]any{"success": true, "items": rows})
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

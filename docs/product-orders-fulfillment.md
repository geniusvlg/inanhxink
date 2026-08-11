# Product Orders and Fulfillment

## Checkout Image Uploads (customer-facing: Zalo, not in-app)

As of commit `1b48f71` (2026-05-06, "Fix payment"), checkout **no longer lets
customers upload images in the app**. `CheckoutPage.tsx` Step 2 ("Ghi chú")
only shows a per-item note textarea plus a notice asking customers to send
product photos via Zalo after placing the order, quoting the order code, up to
`max_upload_images` photos:

> Gửi ảnh qua Zalo sau khi đặt hàng. Tối đa {limit} ảnh — nhắn kèm mã đơn hàng
> để shop xử lý đúng đơn.

Admin then attaches the received photos to the order via
`PATCH /api/admin/product-orders/:id/items` (see "Admin Fulfillment" below).

The old in-checkout upload plumbing below is still present in the backend
(and as dead/unused code in the frontend — `handleFileAdd`,
`uploadProductImages`, etc. in `CheckoutPage.tsx`), kept in case this flow is
re-enabled, but it is not exercised by the current UI:

Product checkout used to upload customer images immediately to S3 under:

```text
product-orders/temp/{cart_session_id}/
```

The `cart_session_id` is a UUID stored in browser storage for normal cart checkout.
For buy-now checkout, a separate UUID is stored in the buy-now draft. These UUIDs
are intentionally not invoice numbers.

Product-order uploads are used for printing and handcrafted souvenirs, so the Go
backend keeps the customer's original image bytes and file format for any upload
under `product-orders/`. These images are not converted to WebP. Other image
uploads still use the normal WebP conversion path unless explicitly changed.

## Customer order tracking (invoice)

Customers can look up order status on the storefront using their **invoice
number** (`product_orders.invoice_number`, e.g. `INXK37PRMDZ`):

- Page: `/tra-cuu-don-hang` (alias: `/theo-doi-don-hang`)
- API: `GET /api/orders/track?code={invoice_or_qr_name}` (Go backend)
- Feature flag: `page_order_tracking`

The same API also matches paid QR keychain orders by `qr_name` when the code
does not match a product invoice.

When admin moves an order to `shipped`, only the SPX `tracking_code` is required.
The backend auto-sets `shipping_carrier` to `SPX`.

After shipment, `/tra-cuu-don-hang` fetches live delivery status from the SPX
public tracking API via `GET /api/orders/spx-tracking?spx_tn={tracking_code}`.
The backend proxies `https://spx.vn/shipment/order/open/order/get_order_info`
and returns a normalized milestone stepper plus event timeline for the customer
UI.

The tracking response also returns the read-only order `items` array so
customers can review what they ordered; product image URLs are rewritten through
the CDN at response time.

## Payment and S3 Movement

This section describes the legacy in-checkout upload path's backend behavior
(see note above — the frontend no longer drives it, but the code path and S3
lifecycle rules remain in place).

Unpaid product-order images remain in `product-orders/temp/{cart_session_id}/`.
They must not be moved to `paid/` at order creation time.

Product-order VietQR payment details are generated with the product-specific
SePay account settings: `SEPAY_PRODUCT_ACCOUNT_NO`,
`SEPAY_PRODUCT_ACCOUNT_NAME`, and `SEPAY_PRODUCT_BANK`. If those are not
configured, the backend falls back to `SEPAY_ACCOUNT_NO`, `SEPAY_ACCOUNT_NAME`,
and `SEPAY_BANK`.

When the SePay product payment webhook confirms payment:

1. The product order is marked `payment_status = 'paid'`.
2. The provider `referenceCode` is stored on `product_transaction`.
3. The latest `items` JSON is fetched from `product_orders`.
4. Image URLs in those items are moved from:

   ```text
   product-orders/temp/{cart_session_id}/
   ```

   to:

   ```text
   product-orders/paid/{order_id}/
   ```

5. The `product_orders.items` JSON is rewritten with the paid URLs.

This lets unpaid orders expire naturally while paid orders become available for
fulfillment and admin download.

## S3 Lifecycle

Only `uploads/temp/` (QR order music/voice uploads, see
`docs/qr-voice-recording.md`) currently needs a lifecycle rule:

- `uploads/temp/` expires after 1 day.

`product-orders/temp/` and `product-orders/paid/` **do not** currently have
lifecycle rules. Since checkout no longer uploads customer images in-app (see
"Checkout Image Uploads" above), nothing writes to those prefixes today. The
upload endpoint and `temp/` → `paid/` move-on-payment code still exist and
are not blocked, so if that flow is ever re-enabled (or called directly),
re-add the `product-orders/temp/` (1 day) and `product-orders/paid/` (7 days)
expiration rules at that time.

Current S3 vendor is VNG Cloud vStorage (`S3_ENDPOINT` in `backend-golang/.env`).
Its S3-compatible API returns blank `<Message>` fields on error responses,
which crashes `aws-cli`'s own error-message enhancer with
`TypeError: argument of type 'NoneType' is not a container or iterable` —
this happens on **any** error (including harmless ones like "no lifecycle
configured yet"), not just real failures. Passing `--region` (any value, it's
ignored by the endpoint) avoids one known trigger of this bug on `s3api`
calls, but `s3cmd` is more reliable for this vendor when inspecting
error/edge-case responses (e.g. `s3cmd getlifecycle s3://inanhxink-prod`).

Example AWS CLI command:

```bash
AWS_ACCESS_KEY_ID="your_access_key" \
AWS_SECRET_ACCESS_KEY="your_secret_key" \
aws --region us-east-1 s3api put-bucket-lifecycle-configuration \
  --bucket inanhxink-prod \
  --endpoint-url https://hcm04.vstorage.vngcloud.vn \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "ExpireQRTempUploadsAfter1Day",
        "Status": "Enabled",
        "Filter": { "Prefix": "uploads/temp/" },
        "Expiration": { "Days": 1 }
      }
    ]
  }'
```

Adjust `--bucket` for dev/prod (`inanhxink-dev` vs `inanhxink-prod`).

## Per-Product Customer Image Limit

Products have `max_upload_images INTEGER NOT NULL DEFAULT 15`.

Admin can edit this number in the product form (`ProductItemsPage.tsx`). Checkout
refreshes product metadata from `/api/products/:id` and uses the latest
`max_upload_images`, so existing cart items still pick up admin changes.

Frontend checkout behavior (current, Zalo-based flow):

- Step 2 shows the Zalo notice with the per-product limit interpolated:
  `Tối đa {limit} ảnh — nhắn kèm mã đơn hàng để shop xử lý đúng đơn.`
- No in-app file picker or upload counter is shown — `max_upload_images` is
  purely informational text telling the customer how many photos to send over
  Zalo.

Backend behavior:

- `CreateProductOrder` validates each submitted item's `image_urls` count against
  the current product `max_upload_images`. This still applies if `image_urls`
  is populated by any caller (e.g. a future re-enabled upload UI, or direct API
  use), even though the current checkout UI never submits any.
- Admin-attached images via `PATCH /api/admin/product-orders/:id/items` are not
  currently capped by `max_upload_images`.

## Shipping Fee

Product orders have `shipping_fee DECIMAL(12,2) NOT NULL DEFAULT 0`.

Admin configures shipping in `ConfigPage.tsx` through metadata:

- `product_shipping_fee`: fixed shipping fee in VND.
- `product_shipping_fee_threshold`: product subtotal required for bank-transfer
  orders to get free shipping.

`product_shipping_fee` defaults to `30000` in migration
`V57__product_shipping_fee_config.sql`; set it to `0` for free shipping.
`product_shipping_fee_threshold` defaults to `149000`. **Chuyển khoản** orders
below that subtotal pay `product_shipping_fee`, while orders at or above the
threshold store `shipping_fee = 0`. Admin can still set the threshold to `0` to
make all bank-transfer orders free-shipping.

Checkout shows `Phí ship` from the same metadata, and `CreateProductOrder`
refreshes each product's active price from the database, recalculates the fee
server-side, stores it on `product_orders.shipping_fee`, and adds it to
`total_amount`.

COD deposits are configured separately with `product_cod_fee_percent`. For COD,
`cod_fee` is calculated as that percent of the order total including shipping;
the remaining balance is collected on delivery.

## Admin Fulfillment

`/admin/fulfillment` shows only paid fulfillment orders.

### Column date scope

The board shows **all** orders by default — there is no "Hôm nay" (today-only)
toggle. The first three columns (`new`, `preparing`, `packing`) always show full
history so nothing in progress is ever hidden. The **`shipped`
("Đã giao vận chuyển")** column is restricted to orders **modified within the last
3 days** (`AND updated_at >= NOW() - INTERVAL '3 days'`) to keep an
ever-growing column manageable; it still paginates 30 at a time via "Xem thêm".

Caveat: `updated_at` is a generic last-modified stamp, not a ship date — payment
status changes and admin edits bump it too (`admin/orders.go`,
`admin/product_orders.go`, SePay webhook in `payments.go`). An older order that is
edited therefore reappears in the shipped column for another 3 days. A dedicated
`shipped_at` column would be needed to scope strictly by ship date.

Because the column is scoped by that timestamp, cards in the `shipped` column
show the **ship date** prefixed with 🚚 instead of the order date (the order date
moves into the expanded card as "Ngày đặt"). Cards in the other three columns keep
showing the order date.

The filter lives in the Go handler `ListFulfillmentOrders`
(`backend-golang/internal/handlers/admin/product_orders.go`). The old `today_only`
query param was removed, and `listFulfillment` in
`admin-app/src/services/api.ts` no longer sends it.

Admins can:

- Search paid product/QR orders by code.
- Open a detail modal.
- View all product images and customer notes.
- Add or remove images from product order items.
- Edit customer phone/address if the customer keyed it incorrectly.
- Copy the full customer note.
- Download all images for an item. On Chrome/Edge, the File System Access API lets
  admin choose a folder and saves the images there. Other browsers fall back to
  normal browser downloads.
- Confirm before saving changes.

The fulfillment modal should render S3-backed image previews through the admin
`resolveAssetUrl` helper, but persisted values remain raw S3 URLs.


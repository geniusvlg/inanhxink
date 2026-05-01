# Product Orders and Fulfillment

## Checkout Image Uploads

Product checkout uploads customer images immediately to S3 under:

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

When admin moves an order to `shipped`, both `tracking_code` and
`shipping_carrier` are required and are shown on the customer tracking page.
The tracking response also returns the read-only order `items` array so
customers can review what they ordered; product image URLs are rewritten through
the CDN at response time.

## Payment and S3 Movement

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

Use S3 lifecycle rules for product-order image cleanup:

- `product-orders/temp/` expires after 1 day.
- `product-orders/paid/` expires after 7 days.

Example AWS CLI command:

```bash
AWS_ACCESS_KEY_ID="your_access_key" \
AWS_SECRET_ACCESS_KEY="your_secret_key" \
aws s3api put-bucket-lifecycle-configuration \
  --bucket inanhxink-prod \
  --endpoint-url https://s3-north1.viettelidc.com.vn \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "ExpireProductTempUploadsAfter1Day",
        "Status": "Enabled",
        "Filter": { "Prefix": "product-orders/temp/" },
        "Expiration": { "Days": 1 }
      },
      {
        "ID": "ExpireProductPaidUploadsAfter7Days",
        "Status": "Enabled",
        "Filter": { "Prefix": "product-orders/paid/" },
        "Expiration": { "Days": 7 }
      },
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

Frontend checkout behavior:

- Shows `Thêm ảnh (current/limit)`.
- Shows a helper note: `Tối đa {limit} ảnh cho sản phẩm này.`
- Blocks adding more than the per-product limit.

Backend behavior:

- `CreateProductOrder` validates each submitted item's `image_urls` count against
  the current product `max_upload_images`.
- This protects against users bypassing the frontend.

## Admin Fulfillment

`/admin/fulfillment` shows only paid fulfillment orders.

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


# Payment Feature

## Overview

Customers choose a **payment method** at checkout:
- **Chuyển khoản** (bank transfer) — QR shows the full order total. Shipping is free only when the product subtotal reaches `product_shipping_fee_threshold` (default `149000`; `0` means always free ship).
- **Ship COD** — order total includes the fixed shipping fee (`product_shipping_fee`), QR shows the configured deposit percent (`product_cod_fee_percent`), and the remainder is collected on delivery. Admin sees "Đã cọc / Còn lại" in fulfillment.

The project has **two independent order flows**, both backed by [SePay](https://sepay.vn) (Vietnamese payment aggregator):

1. **QR Order Payment** — customer pays for a personalised `*.inanhxink.com` subdomain
2. **Product Checkout Payment** — customer pays for physical merchandise

---

## Payment Method (Product orders only)

`payment_method` is stored on `product_orders`. Default is `'bank_transfer'`.

| Value | QR amount | Shipping |
|-------|-----------|---------|
| `bank_transfer` | `total_amount` | `0` when subtotal >= `product_shipping_fee_threshold`; otherwise fixed `product_shipping_fee` |
| `cod` | `cod_fee` (`product_cod_fee_percent` of total) | Fixed `product_shipping_fee`; rest collected on delivery |

`cod_fee` is calculated from `metadata.product_cod_fee_percent` at order creation time and stored on `product_orders.cod_fee`.

Admin configures shipping fee and the bank-transfer free-shipping threshold in **Config → 📦 Phí ship**, and the COD deposit percent in **Config → 🚚 Ship COD**. Setting the COD percent to `100` hides the COD option on checkout.

---

## 1. QR Order Payment

### Flow

```
OrderPage → /payment/:qrName → PaymentPage.tsx
```

1. Customer submits an order on `OrderPage.tsx`.
2. Redirected to `/payment/:qrName`.
3. `PaymentPage.tsx` calls `GET /api/payments/qr/:qrName` to fetch order + existing payment.
4. If no payment exists, calls `POST /api/payments` to create one (generates SePay QR URL).
5. Page polls `GET /api/payments/qr/:qrName` every 2 s for up to 2 minutes.
6. When `paymentStatus === 'paid'`, redirect to `/qr/:qrName` (QR customisation page).

### Backend endpoints

| Method | Route | Handler |
|--------|-------|---------|
| `POST` | `/api/payments` | `CreatePayment` |
| `GET` | `/api/payments/qr/:qrName` | `GetPaymentByQR` |
| `POST` | `/api/payments/webhook/qr` | `QRPaymentWebhook` |
| `POST` | `/api/payments/checkout` | `CreateCheckout` (SePay Checkout redirect flow) |

### DB tables

- `orders` — `payment_status` field (`pending` → `paid` / `cancelled`)
- `qr_transaction` — `order_id`, `amount`, `status`, `payment_qr_url`, `sepay_transaction_id`, `webhook_payload`, `paid_at`

### Payment code format

`INXK{orderID}{qrName}` — e.g. `INXK42anhyeuem`

### On webhook confirm

1. Marks `qr_transaction` row as `paid`.
2. Marks `orders.payment_status = 'paid'`.
3. Cancels all other pending orders for same `qr_name` (advisory lock).
4. Upserts into `qr_codes` table.
5. Goroutine: `migrateQRUploads` — moves temp S3 files to permanent path.
6. Sends notification via `notify.QROrderPaid`.

---

## 2. Product Checkout Payment

### Flow

```
CheckoutPage (select payment method) → POST /api/product-orders → /checkout/payment/:orderId → ProductCheckoutPaymentPage.tsx
```

1. Customer fills out `CheckoutPage.tsx`, picks Chuyển khoản or Ship COD.
2. `POST /api/product-orders` recalculates subtotal from current product prices, applies `product_shipping_fee` for COD and for bank-transfer orders below `product_shipping_fee_threshold`, then stores `payment_method`, `shipping_fee`, and `cod_fee`.
3. Redirected to `/checkout/payment/:orderId`.
4. `ProductCheckoutPaymentPage.tsx` calls `GET /api/payments/product/:orderId`.
   - For COD: QR amount = `cod_fee`; shows deposit note with remaining balance.
   - For bank transfer: QR amount = `total_amount` (including shipping when below the free-shipping threshold).
5. Page polls every 2 s for up to 2 minutes.
6. When `paymentStatus === 'paid'`, cart is reset, user sent to `/checkout/result`.

### Backend endpoints

| Method | Route | Handler |
|--------|-------|---------|
| `GET` | `/api/payments/product/:orderId` | `GetProductPayment` |
| `POST` | `/api/payments/webhook/product` | `ProductPaymentWebhook` |
| `POST` | `/api/payments/product-checkout` | `CreateProductCheckout` (SePay Checkout redirect) |

### DB tables

- `product_orders` — `payment_status`, `payment_method`, `shipping_fee`, `cod_fee`, `invoice_number`, `items` (JSONB)
- `product_transaction` — `product_order_id`, `amount`, `status`, `payment_qr_url`, `sepay_transaction_id`, `paid_at`

### Payment code / Webhook matching

`invoice_number = INXK{orderID}{randomSuffix5}` — matched via `ILIKE '%' || invoice_number || '%'` in transfer content.

For COD, webhook required amount = `cod_fee` (not `total_amount`).

### On webhook confirm

1. `product_orders.payment_status = 'paid'`.
2. `product_transaction` row updated to `paid`.
3. `IncrementProductSoldCounts` per item.
4. Goroutine: `MoveTempImages` moves S3 temp images.
5. Sends notification via `notify.ProductOrderPaid`.

### Admin fulfillment display

For COD orders, fulfillment cards show:
- **Đã cọc**: `cod_fee`
- **Còn lại**: `total_amount − cod_fee`

---

## Payment Provider: SePay

### Bank-transfer QR

```
https://qr.sepay.vn/img?acc={accountNo}&bank={bank}&amount={qrAmount}&des={paymentCode}&template=compact
```

`qrAmount` = `cod_fee` for COD orders, `total_amount` for bank transfer.

### SePay Checkout (redirect flow, optional)

- Live: `https://pay.sepay.vn/v1/checkout/init`
- Sandbox: `https://pay-sandbox.sepay.vn/v1/checkout/init` (if secret lacks `spsk_live_` prefix)
- Fields signed with HMAC-SHA256 base64; exact field order matters.

### Webhook auth

`Authorization: Apikey {SEPAY_API_KEY}`

---

## Environment Variables

| Variable | Purpose | Fallback |
|----------|---------|---------|
| `SEPAY_API_KEY` | Webhook auth | — (required) |
| `SEPAY_ACCOUNT_NO` | QR order bank account | — |
| `SEPAY_ACCOUNT_NAME` | QR order account name | — |
| `SEPAY_BANK` | QR order bank name | `MBBank` |
| `SEPAY_MERCHANT_ID` | SePay Checkout merchant ID | — |
| `SEPAY_SECRET_KEY` | Checkout HMAC secret | falls back to `SEPAY_CHECKOUT_SECRET` |
| `SEPAY_PRODUCT_ACCOUNT_NO` | Product order bank account | falls back to `SEPAY_ACCOUNT_NO` |
| `SEPAY_PRODUCT_ACCOUNT_NAME` | Product order account name | falls back to `SEPAY_ACCOUNT_NAME` |
| `SEPAY_PRODUCT_BANK` | Product order bank name | falls back to `SEPAY_BANK` |

---

## Frontend Polling

Both payment pages: 2-second interval, 2-minute timeout. Countdown displayed; shows reload prompt on expiry.

---

## Key Files

| File | Role |
|------|------|
| `backend-golang/internal/handlers/payments.go` | All payment handlers |
| `backend-golang/internal/handlers/product_orders.go` | `CreateProductOrder` — stores `payment_method`, `shipping_fee`, and `cod_fee` |
| `backend-golang/database/V56__product_order_payment_method.sql` | Adds `payment_method`, `cod_fee` columns + `product_cod_fee_percent` metadata |
| `backend-golang/database/V57__product_shipping_fee_config.sql` | Adds `product_shipping_fee` metadata |
| `backend-golang/database/V58__clarify_cod_shipping_fee.sql` | Re-activates `product_shipping_fee_threshold` for bank-transfer free shipping |
| `frontend-app/src/pages/CheckoutPage.tsx` | Checkout form with payment method selector |
| `frontend-app/src/pages/PaymentPage.tsx` | QR order payment UI |
| `frontend-app/src/pages/ProductCheckoutPaymentPage.tsx` | Product checkout payment UI (shows COD deposit note) |
| `admin-app/src/pages/FulfillmentPage.tsx` | Shows COD badge, Đã cọc / Còn lại |
| `admin-app/src/pages/ConfigPage.tsx` | Config → 📦 Phí ship and 🚚 Ship COD |

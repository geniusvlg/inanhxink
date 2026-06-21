# Freeship (Free Shipping) Policy — REMOVED

The threshold-based free shipping feature has been removed. Shipping is now always free for **Chuyển khoản** orders. For **Ship COD** orders, a fixed deposit is charged (see `docs/payment-feature.md`).

## What was removed

The feature previously charged a shipping fee when the order subtotal was below a configured threshold. It was removed in favour of the simpler COD/bank-transfer model.

## Deprecated DB artifacts

Migration `V55__deprecate_shipping_fee_policy.sql` marks the leftovers:

| Artifact | Status |
|----------|--------|
| `product_orders.shipping_fee` column | Kept for historical data; always `0` for new orders |
| `metadata.product_shipping_fee_threshold` | Kept; description updated to `[DEPRECATED]` |
| `metadata.product_shipping_fee_below_threshold` | Kept; description updated to `[DEPRECATED]` |

No code reads these values.

# Bank-Transfer Freeship Policy

Bank-transfer orders get free shipping only when the product subtotal reaches `product_shipping_fee_threshold` (default `149000`). If the subtotal is lower, the fixed `product_shipping_fee` is added to the order total. When `product_shipping_fee_threshold = 0`, bank-transfer orders always get free shipping.

For **Ship COD** orders, the fixed `product_shipping_fee` is added to the order total, then the customer pays a `product_cod_fee_percent` deposit by QR and the remainder on delivery (see `docs/payment-feature.md`).

## Deprecated DB artifacts

The old separate "fee below threshold" metadata is still deprecated. The active
policy uses the single fixed shipping fee for both COD and below-threshold bank
transfer.

Migration `V55__deprecate_shipping_fee_policy.sql` marks the leftovers:

| Artifact | Status |
|----------|--------|
| `product_orders.shipping_fee` column | Active; stores the shipping fee charged for the order |
| `metadata.product_shipping_fee_threshold` | Active; bank-transfer free-shipping threshold |
| `metadata.product_shipping_fee_below_threshold` | Kept; description updated to `[DEPRECATED]` |

No code reads `metadata.product_shipping_fee_below_threshold`.

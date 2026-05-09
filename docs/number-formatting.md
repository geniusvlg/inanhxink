# Number formatting (UI)

## Rule

For **every number** shown in the storefront or admin UI, use a **comma as the thousands separator** (e.g. `12,000`, not `12000`).

## Implementation notes

- **Display-only:** `n.toLocaleString('en')` (or `toLocaleString('vi-VN')` only if the locale uses commas for thousands consistently with product expectations; this project standardizes on **comma** separators as in US English locale for admin inputs.)
- **Editable numeric fields:** Prefer `type="text"` with `inputMode="numeric"`, format with commas while typing, and parse by stripping commas and non-digit characters (for integers) before save or API calls.
- **Money** in admin already uses comma formatting helpers (e.g. `formatMoneyInputWithCommas` on product/variant price fields).
- **Counts** (e.g. Đã bán / `sold_count`): use the same comma pattern as other admin numbers.

### Đã bán (storefront only)

On the public site, **sold count** uses compact **k** when the value is **≥ 1 000**:

- Below 1 000: comma-grouped digits (`999`, `1,234` style via `en` locale).
- From 1 000: `1k`, `1,3k` (comma = decimal separator), `10k`, `11k`, `1200k` for exact multiples of 1 000, etc.

Implemented in `frontend-app/src/components/ProductSoldCount.tsx` (`formatDaBanSoldDisplay`). Admin continues to show/edit the full integer.

Keep this in sync when adding new numeric inputs or summary stats.

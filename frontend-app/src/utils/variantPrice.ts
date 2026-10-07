/** Variant fields needed to price a product the same way on cards and the detail page. */
export interface VariantPriceSource {
  price: number;
  discount_price?: number | null;
  discount_from?: string | null;
  discount_to?: string | null;
}

export interface VariantPriceRange {
  minEffective: number;
  maxEffective: number;
  minOriginal: number;
  maxOriginal: number;
  hasDiscount: boolean;
}

/** Active sale price for a variant, or its list price when the discount window is closed. */
export function getVariantEffectivePrice(v: VariantPriceSource): number {
  if (v.discount_price != null) {
    const now = Date.now();
    const from = v.discount_from ? new Date(v.discount_from).getTime() : null;
    const to = v.discount_to ? new Date(v.discount_to).getTime() : null;
    const fromOk = from == null || from <= now;
    const toOk = to == null || to >= now;
    if (fromOk && toOk) return v.discount_price;
  }
  return v.price;
}

export function computeVariantPriceRange(variants: VariantPriceSource[]): VariantPriceRange {
  const effectives = variants.map(getVariantEffectivePrice);
  const originals = variants.map(v => v.price);
  return {
    minEffective: Math.min(...effectives),
    maxEffective: Math.max(...effectives),
    minOriginal: Math.min(...originals),
    maxOriginal: Math.max(...originals),
    hasDiscount: variants.some(v => getVariantEffectivePrice(v) < v.price),
  };
}

/** Largest rounded % off among variants (effective vs that variant's list price). */
export function maxVariantDiscountPercent(variants: VariantPriceSource[]): number {
  let max = 0;
  for (const v of variants) {
    const eff = getVariantEffectivePrice(v);
    if (eff >= v.price) continue;
    const pct = Math.round((1 - eff / v.price) * 100);
    if (pct > max) max = pct;
  }
  return max;
}

export function formatVnd(price: number): string {
  return Math.round(price).toLocaleString('vi-VN') + 'đ';
}

/** "125.000đ" or "125.000đ - 300.000đ" from the effective variant prices. */
export function formatVariantPriceLabel(range: VariantPriceRange): string {
  if (range.minEffective === range.maxEffective) return formatVnd(range.minEffective);
  return `${formatVnd(range.minEffective)} - ${formatVnd(range.maxEffective)}`;
}

export function formatVariantOriginalLabel(range: VariantPriceRange): string {
  if (range.minOriginal === range.maxOriginal) return formatVnd(range.minOriginal);
  return `${formatVnd(range.minOriginal)} - ${formatVnd(range.maxOriginal)}`;
}

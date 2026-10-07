import { type Product } from '../services/api';
import {
  computeVariantPriceRange,
  formatVariantOriginalLabel,
  formatVariantPriceLabel,
  formatVnd,
  maxVariantDiscountPercent,
  type VariantPriceSource,
} from '../utils/variantPrice';
import './PriceTag.css';

function fmt(price: number): string {
  return formatVnd(price);
}

function variantSources(product: Pick<Product, 'variants' | 'variant_prices'>): VariantPriceSource[] | null {
  if (product.variants && product.variants.length > 0) return product.variants;
  if (product.variant_prices && product.variant_prices.length > 0) return product.variant_prices;
  return null;
}

/** Returns the active discount price if the discount window is currently open, otherwise null. */
export function getActiveDiscountPrice(product: Pick<Product, 'price' | 'discount_price' | 'discount_from' | 'discount_to'>): number | null {
  if (product.discount_price == null) return null;
  const salePrice = Number(product.discount_price);
  if (!Number.isFinite(salePrice) || salePrice < 0) return null;

  const now = Date.now();
  if (product.discount_from && new Date(product.discount_from).getTime() > now) return null;
  if (product.discount_to   && new Date(product.discount_to).getTime()   < now) return null;
  return salePrice;
}

interface Props {
  product: Pick<Product, 'price' | 'discount_price' | 'discount_from' | 'discount_to' | 'variants' | 'variant_prices'>;
  className?: string;
}

/** Renders price — variant range when types differ, otherwise sale price + struck-through original. */
export default function PriceTag({ product, className }: Props) {
  const sources = variantSources(product);
  if (sources) {
    const range = computeVariantPriceRange(sources);
    const label = formatVariantPriceLabel(range);
    if (!range.hasDiscount) {
      return <span className={`price-tag-current ${className ?? ''}`.trim()}>{label}</span>;
    }
    const percentOff = maxVariantDiscountPercent(sources);
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em', flexWrap: 'wrap' }}>
        <span className="price-tag-current">{label}</span>
        <span className="price-tag-was">{formatVariantOriginalLabel(range)}</span>
        {percentOff > 0 && (
          <span className="price-tag-off-badge">-{percentOff}%</span>
        )}
      </span>
    );
  }

  const salePrice = getActiveDiscountPrice(product);

  if (salePrice === null) {
    return <span className={`price-tag-current ${className ?? ''}`.trim()}>{fmt(product.price)}</span>;
  }

  const percentOff =
    product.price > 0 ? Math.round(((product.price - salePrice) / product.price) * 100) : 0;

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em', flexWrap: 'wrap' }}>
      <span className="price-tag-current">{fmt(salePrice)}</span>
      <span className="price-tag-was">{fmt(product.price)}</span>
      {percentOff > 0 && (
        <span className="price-tag-off-badge">-{percentOff}%</span>
      )}
    </span>
  );
}

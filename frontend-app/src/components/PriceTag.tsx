import { type Product } from '../services/api';
import './PriceTag.css';

function fmt(price: number): string {
  return Math.round(price).toLocaleString('vi-VN') + 'đ';
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
  product: Pick<Product, 'price' | 'discount_price' | 'discount_from' | 'discount_to'>;
  className?: string;
}

/** Renders price — shows sale price + struck-through original + % off when a discount is active. */
export default function PriceTag({ product, className }: Props) {
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

import { type Product } from '../services/api';

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

/** Renders price — shows sale price + struck-through original when a discount is active. */
export default function PriceTag({ product, className }: Props) {
  const salePrice = getActiveDiscountPrice(product);

  if (salePrice === null) {
    return <span className={className}>{fmt(product.price)}</span>;
  }

  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em', flexWrap: 'wrap' }}>
      <span style={{ color: '#fe2c56', fontWeight: 700 }}>{fmt(salePrice)}</span>
      <span style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.875em' }}>{fmt(product.price)}</span>
    </span>
  );
}

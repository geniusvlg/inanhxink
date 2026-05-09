import './ProductSoldCount.css';

type Props = {
  count: number | null | undefined;
  className?: string;
};

/** Storefront Đã bán: under 1k = comma-grouped; from 1k = compact "k" with comma as decimal (e.g. 1,3k). */
export function formatDaBanSoldDisplay(n: number): string {
  if (!Number.isFinite(n) || n < 1000) {
    return Math.max(0, Math.floor(n)).toLocaleString('en');
  }
  const k = n / 1000;
  if (Number.isInteger(k)) {
    return `${k}k`;
  }
  const rounded = Math.round(k * 10) / 10;
  if (rounded % 1 === 0) {
    return `${Math.round(rounded)}k`;
  }
  return `${rounded.toFixed(1).replace('.', ',')}k`;
}

/** Renders "Đã bán n" for storefront when n is positive. */
export default function ProductSoldCount({ count, className }: Props) {
  const n = count ?? 0;
  if (n <= 0) return null;
  return (
    <div className={className ? `product-sold-count ${className}` : 'product-sold-count'}>
      Đã bán{' '}
      <span className="product-sold-count-num">{formatDaBanSoldDisplay(n)}</span>
    </div>
  );
}

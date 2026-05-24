import type { Product } from '../services/api';

export function getProductThumbnailUrl(product: Pick<Product, 'thumbnail_url' | 'images'>): string | null {
  return product.thumbnail_url || product.images?.[0] || null;
}

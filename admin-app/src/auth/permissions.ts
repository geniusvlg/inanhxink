export const NAV_ITEMS: { to: string; area: string }[] = [
  { to: '/products', area: 'qr_templates' },
  { to: '/thiep', area: 'thiep' },
  { to: '/khung-anh', area: 'khung_anh' },
  { to: '/so-scrapbook', area: 'so_scrapbook' },
  { to: '/cac-san-pham-khac', area: 'khac' },
  { to: '/set-qua-tang', area: 'set_qua_tang' },
  { to: '/in-anh', area: 'in_anh' },
  { to: '/featured-on-home', area: 'featured' },
  { to: '/categories', area: 'categories' },
  { to: '/product-reviews', area: 'product_reviews' },
  { to: '/orders', area: 'product_orders' },
  { to: '/fulfillment', area: 'fulfillment' },
  { to: '/qr-orders', area: 'qr_orders' },
  { to: '/vouchers', area: 'vouchers' },
  { to: '/testimonials', area: 'testimonials' },
  { to: '/banners', area: 'banners' },
  { to: '/hero-shots', area: 'hero_shots' },
  { to: '/config', area: 'config' },
];

export function productArea(type: string): string {
  return type === 'set-qua-tang' ? 'set_qua_tang' : type;
}

export function firstAllowedPath(can: (key: string) => boolean): string | null {
  return NAV_ITEMS.find((item) => can(`${item.area}.view`))?.to ?? null;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import axios from 'axios';

// ── Product-page banner types ───────────────────────────────────────────────
export type ProductPageSlug =
  | 'thiep'
  | 'khung_anh'
  | 'so_scrapbook'
  | 'set_qua_tang'
  | 'cac_san_pham_khac'
  | 'in_anh';

export const PRODUCT_PAGE_SLUGS: ProductPageSlug[] = [
  'thiep',
  'khung_anh',
  'so_scrapbook',
  'set_qua_tang',
  'cac_san_pham_khac',
  'in_anh',
];

export type ProductBannerSlide = {
  imageUrl: string;
  linkUrl?: string;
};

export type ProductBannerMode = 'inherit' | 'custom' | 'disabled';

export type ProductBannerOverride = {
  mode: ProductBannerMode;
  slides?: ProductBannerSlide[];
};

export type ProductBannerOverrides = Record<ProductPageSlug, ProductBannerOverride>;

export interface ProductBannerConfig {
  enabled:   boolean;
  slides:    ProductBannerSlide[];
  overrides: ProductBannerOverrides;
}

export interface FeatureFlags {
  page_qr_yeu_thuong:      boolean;
  page_thiep:              boolean;
  page_khung_anh:          boolean;
  page_so_scrapbook:       boolean;
  page_cac_san_pham_khac:  boolean;
  page_set_qua_tang:       boolean;
  page_in_anh:             boolean;
  products_page_size:      number;
  testimonials_page_size:  number;
  product_banner:          ProductBannerConfig;
}

const DEFAULT_OVERRIDES: ProductBannerOverrides = {
  thiep:             { mode: 'inherit' },
  khung_anh:         { mode: 'inherit' },
  so_scrapbook:      { mode: 'inherit' },
  set_qua_tang:      { mode: 'inherit' },
  cac_san_pham_khac: { mode: 'inherit' },
  in_anh:            { mode: 'inherit' },
};

const DEFAULT_BANNER: ProductBannerConfig = {
  enabled:   false,
  slides:    [],
  overrides: DEFAULT_OVERRIDES,
};

const DEFAULTS: FeatureFlags = {
  page_qr_yeu_thuong:      true,
  page_thiep:              true,
  page_khung_anh:          true,
  page_so_scrapbook:       true,
  page_cac_san_pham_khac:  true,
  page_set_qua_tang:       true,
  page_in_anh:             true,
  products_page_size:      12,
  testimonials_page_size:  12,
  product_banner:          DEFAULT_BANNER,
};

// ── Parse helpers ───────────────────────────────────────────────────────────
function sanitizeSlide(raw: unknown): ProductBannerSlide | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { imageUrl?: unknown; linkUrl?: unknown };
  if (typeof obj.imageUrl !== 'string' || !obj.imageUrl.trim()) return null;
  const slide: ProductBannerSlide = { imageUrl: obj.imageUrl.trim() };
  if (typeof obj.linkUrl === 'string' && obj.linkUrl.trim()) slide.linkUrl = obj.linkUrl.trim();
  return slide;
}

function parseSlides(raw: string | undefined): ProductBannerSlide[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeSlide).filter((s): s is ProductBannerSlide => s !== null);
  } catch {
    return [];
  }
}

function parseOverrides(raw: string | undefined): ProductBannerOverrides {
  const result: ProductBannerOverrides = { ...DEFAULT_OVERRIDES };
  if (!raw) return result;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return result; }
  if (!parsed || typeof parsed !== 'object') return result;
  const obj = parsed as Record<string, unknown>;
  for (const slug of PRODUCT_PAGE_SLUGS) {
    const entry = obj[slug];
    if (!entry || typeof entry !== 'object') continue;
    const { mode, slides } = entry as { mode?: unknown; slides?: unknown };
    const m: ProductBannerMode =
      mode === 'custom' || mode === 'disabled' ? mode : 'inherit';
    const next: ProductBannerOverride = { mode: m };
    if (m === 'custom' && Array.isArray(slides)) {
      next.slides = slides.map(sanitizeSlide).filter((s): s is ProductBannerSlide => s !== null);
    }
    result[slug] = next;
  }
  return result;
}

/** Resolve the slide list to render for a given product page (or null when
 *  the banner should be hidden on that page). */
export function resolveProductBanner(
  config: ProductBannerConfig,
  page: ProductPageSlug,
): ProductBannerSlide[] | null {
  if (!config.enabled) return null;
  const override = config.overrides[page];
  if (override?.mode === 'disabled') return null;
  if (override?.mode === 'custom') {
    const slides = override.slides ?? [];
    return slides.length > 0 ? slides : null;
  }
  return config.slides.length > 0 ? config.slides : null;
}

// ── Context ─────────────────────────────────────────────────────────────────
const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULTS);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || '';
    axios.get<{ success: boolean; config: Record<string, string> }>(`${apiBase}/api/metadata`)
      .then(res => {
        const c = res.data.config ?? {};
        setFlags({
          page_qr_yeu_thuong:     c.page_qr_yeu_thuong     !== 'false',
          page_thiep:             c.page_thiep             !== 'false',
          page_khung_anh:         c.page_khung_anh         !== 'false',
          page_so_scrapbook:      c.page_so_scrapbook      !== 'false',
          page_cac_san_pham_khac: c.page_cac_san_pham_khac !== 'false',
          page_set_qua_tang:      c.page_set_qua_tang      !== 'false',
          page_in_anh:            c.page_in_anh            !== 'false',
          products_page_size:     Math.max(1, parseInt(c.products_page_size) || 12),
          testimonials_page_size: Math.max(1, parseInt(c.testimonials_page_size) || 12),
          product_banner: {
            enabled:   c.product_banner_enabled === 'true',
            slides:    parseSlides(c.product_banner_slides),
            overrides: parseOverrides(c.product_banner_overrides),
          },
        });
      })
      .catch(() => { /* keep defaults — all enabled */ });
  }, []);

  return (
    <FeatureFlagsContext.Provider value={flags}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}

/** Convenience hook — returns the resolved slide list for the given product
 *  page, or `null` if the banner should not render there. */
export function useProductBanner(page: ProductPageSlug): ProductBannerSlide[] | null {
  const { product_banner } = useFeatureFlags();
  return useMemo(() => resolveProductBanner(product_banner, page), [product_banner, page]);
}

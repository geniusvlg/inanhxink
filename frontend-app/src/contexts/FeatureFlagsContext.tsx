import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';

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
}

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
};

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

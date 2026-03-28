import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';

export interface FeatureFlags {
  page_qr_yeu_thuong: boolean;
  page_thiep:         boolean;
  page_khung_anh:     boolean;
  page_so_scrapbook:  boolean;
}

const DEFAULTS: FeatureFlags = {
  page_qr_yeu_thuong: true,
  page_thiep:         true,
  page_khung_anh:     true,
  page_so_scrapbook:  true,
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
          page_qr_yeu_thuong: c.page_qr_yeu_thuong !== 'false',
          page_thiep:         c.page_thiep         !== 'false',
          page_khung_anh:     c.page_khung_anh     !== 'false',
          page_so_scrapbook:  c.page_so_scrapbook  !== 'false',
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

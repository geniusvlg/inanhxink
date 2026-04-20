import { useState, useEffect, useRef, useMemo } from 'react';
import { metadataApi, uploadApi } from '../services/api';
import '../components/Layout.css';
import './ConfigPage.css';

const PAGE_FLAGS: { key: string; label: string; description: string }[] = [
  { key: 'page_qr_yeu_thuong',     label: 'QR Yêu Thương',      description: 'Trang tạo QR code cá nhân' },
  { key: 'page_thiep',             label: 'Thiệp',              description: 'Trang sản phẩm thiệp' },
  { key: 'page_khung_anh',         label: 'Khung Ảnh',          description: 'Trang sản phẩm khung ảnh' },
  { key: 'page_so_scrapbook',      label: 'Sổ & Scrapbook',     description: 'Trang sản phẩm sổ và phụ kiện scrapbook' },
  { key: 'page_cac_san_pham_khac', label: 'Các Sản Phẩm Khác', description: 'Trang các sản phẩm khác' },
  { key: 'page_in_anh',            label: 'In Ảnh',            description: 'Trang dịch vụ in ảnh' },
];

// ── Product-page banner types & helpers ─────────────────────────────────────
type ProductPageSlug =
  | 'thiep' | 'khung_anh' | 'so_scrapbook'
  | 'set_qua_tang' | 'cac_san_pham_khac' | 'in_anh';

type BannerMode = 'inherit' | 'custom' | 'disabled';

interface BannerSlide {
  imageUrl: string;
  linkUrl?: string;
}

interface BannerOverride {
  mode: BannerMode;
  slides?: BannerSlide[];
}

type Overrides = Record<ProductPageSlug, BannerOverride>;

const BANNER_PAGES: { slug: ProductPageSlug; label: string }[] = [
  { slug: 'thiep',             label: 'Thiệp' },
  { slug: 'khung_anh',         label: 'Khung Ảnh' },
  { slug: 'so_scrapbook',      label: 'Sổ & Scrapbook' },
  { slug: 'set_qua_tang',      label: 'Set Quà Tặng' },
  { slug: 'cac_san_pham_khac', label: 'Các Sản Phẩm Khác' },
  { slug: 'in_anh',            label: 'In Ảnh' },
];

const BANNER_KEYS = new Set([
  'product_banner_enabled',
  'product_banner_slides',
  'product_banner_overrides',
]);

const DEFAULT_OVERRIDES: Overrides = {
  thiep:             { mode: 'inherit' },
  khung_anh:         { mode: 'inherit' },
  so_scrapbook:      { mode: 'inherit' },
  set_qua_tang:      { mode: 'inherit' },
  cac_san_pham_khac: { mode: 'inherit' },
  in_anh:            { mode: 'inherit' },
};

function sanitizeSlide(raw: unknown): BannerSlide | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { imageUrl?: unknown; linkUrl?: unknown };
  if (typeof o.imageUrl !== 'string' || !o.imageUrl.trim()) return null;
  const out: BannerSlide = { imageUrl: o.imageUrl.trim() };
  if (typeof o.linkUrl === 'string' && o.linkUrl.trim()) out.linkUrl = o.linkUrl.trim();
  return out;
}

function parseSlides(raw: string | undefined): BannerSlide[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeSlide).filter((s): s is BannerSlide => s !== null);
  } catch {
    return [];
  }
}

function parseOverrides(raw: string | undefined): Overrides {
  const out: Overrides = { ...DEFAULT_OVERRIDES };
  if (!raw) return out;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return out; }
  if (!parsed || typeof parsed !== 'object') return out;
  const obj = parsed as Record<string, unknown>;
  for (const { slug } of BANNER_PAGES) {
    const entry = obj[slug];
    if (!entry || typeof entry !== 'object') continue;
    const { mode, slides } = entry as { mode?: unknown; slides?: unknown };
    const m: BannerMode = mode === 'custom' || mode === 'disabled' ? mode : 'inherit';
    const next: BannerOverride = { mode: m };
    if (m === 'custom' && Array.isArray(slides)) {
      next.slides = slides.map(sanitizeSlide).filter((s): s is BannerSlide => s !== null);
    }
    out[slug] = next;
  }
  return out;
}

/** Collect every imageUrl currently referenced in the config (global +
 *  per-page custom). Used to compute orphans on save and on local removal. */
function collectImageUrls(globalSlides: BannerSlide[], overrides: Overrides): Set<string> {
  const set = new Set<string>();
  for (const s of globalSlides) set.add(s.imageUrl);
  for (const o of Object.values(overrides)) {
    if (o.mode === 'custom' && o.slides) {
      for (const s of o.slides) set.add(s.imageUrl);
    }
  }
  return set;
}

export default function ConfigPage() {
  const [config,  setConfig]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  // Banner state — split out so the editor doesn't have to re-parse JSON on
  // every render.
  const [bannerEnabled,   setBannerEnabled]   = useState(false);
  const [globalSlides,    setGlobalSlides]    = useState<BannerSlide[]>([]);
  const [overrides,       setOverrides]       = useState<Overrides>(DEFAULT_OVERRIDES);
  // Snapshot of imageUrls that were already persisted in the DB on load — used
  // to compute orphan deletions on save.
  const originalUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    metadataApi.get()
      .then(r => {
        const cfg = r.data.config ?? {};
        setConfig(cfg);
        const slides = parseSlides(cfg.product_banner_slides);
        const ovr    = parseOverrides(cfg.product_banner_overrides);
        setBannerEnabled(cfg.product_banner_enabled === 'true');
        setGlobalSlides(slides);
        setOverrides(ovr);
        originalUrlsRef.current = collectImageUrls(slides, ovr);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: string, enabled: boolean) => {
    setConfig(c => ({ ...c, [key]: enabled ? 'true' : 'false' }));
  };

  const handleChange = (key: string, value: string) => {
    setConfig(c => ({ ...c, [key]: value }));
  };

  // ── Banner mutations ─────────────────────────────────────────────────────
  /** Best-effort delete of a URL that was uploaded *during this session* and
   *  is being removed before save (i.e. orphan cleanup). */
  const purgeIfUnsaved = (url: string) => {
    if (url && !originalUrlsRef.current.has(url)) {
      uploadApi.deleteMany([url]);
    }
  };

  const updateGlobalSlide = (idx: number, patch: Partial<BannerSlide>) => {
    setGlobalSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };
  const removeGlobalSlide = (idx: number) => {
    setGlobalSlides(prev => {
      const removed = prev[idx];
      if (removed) purgeIfUnsaved(removed.imageUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };
  const moveGlobalSlide = (idx: number, dir: -1 | 1) => {
    setGlobalSlides(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const addGlobalSlide = (slide: BannerSlide) => {
    setGlobalSlides(prev => [...prev, slide]);
  };

  const setOverrideMode = (slug: ProductPageSlug, mode: BannerMode) => {
    setOverrides(prev => {
      const cur = prev[slug];
      // Switching out of custom → drop unsaved uploads from the override
      if (cur.mode === 'custom' && mode !== 'custom' && cur.slides) {
        for (const s of cur.slides) purgeIfUnsaved(s.imageUrl);
      }
      const next: BannerOverride = mode === 'custom'
        ? { mode, slides: cur.slides ?? [] }
        : { mode };
      return { ...prev, [slug]: next };
    });
  };

  const updateOverrideSlide = (slug: ProductPageSlug, idx: number, patch: Partial<BannerSlide>) => {
    setOverrides(prev => {
      const cur = prev[slug];
      const slides = (cur.slides ?? []).map((s, i) => i === idx ? { ...s, ...patch } : s);
      return { ...prev, [slug]: { ...cur, slides } };
    });
  };
  const removeOverrideSlide = (slug: ProductPageSlug, idx: number) => {
    setOverrides(prev => {
      const cur = prev[slug];
      const removed = cur.slides?.[idx];
      if (removed) purgeIfUnsaved(removed.imageUrl);
      const slides = (cur.slides ?? []).filter((_, i) => i !== idx);
      return { ...prev, [slug]: { ...cur, slides } };
    });
  };
  const moveOverrideSlide = (slug: ProductPageSlug, idx: number, dir: -1 | 1) => {
    setOverrides(prev => {
      const cur = prev[slug];
      const target = idx + dir;
      const slides = cur.slides ?? [];
      if (target < 0 || target >= slides.length) return prev;
      const next = slides.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, [slug]: { ...cur, slides: next } };
    });
  };
  const addOverrideSlide = (slug: ProductPageSlug, slide: BannerSlide) => {
    setOverrides(prev => {
      const cur = prev[slug];
      return { ...prev, [slug]: { ...cur, slides: [...(cur.slides ?? []), slide] } };
    });
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, string> = { ...config };
      // Banner-managed keys: write the live state, ignore any stale string
      // copies that might have been carried in `config`.
      for (const k of BANNER_KEYS) delete payload[k];
      payload.product_banner_enabled   = bannerEnabled ? 'true' : 'false';
      payload.product_banner_slides    = JSON.stringify(globalSlides);
      payload.product_banner_overrides = JSON.stringify(overrides);

      await metadataApi.update(payload);

      // Orphan cleanup: delete any S3 image that was persisted before but is
      // no longer referenced after this save.
      const currentUrls = collectImageUrls(globalSlides, overrides);
      const orphans = Array.from(originalUrlsRef.current).filter(u => !currentUrls.has(u));
      if (orphans.length > 0) uploadApi.deleteMany(orphans);
      originalUrlsRef.current = currentUrls;

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Other config keys = anything that isn't a page flag and isn't banner-managed
  const pageFlagKeys = new Set(PAGE_FLAGS.map(f => f.key));
  const otherEntries = useMemo(
    () => Object.entries(config).filter(([k]) => !pageFlagKeys.has(k) && !BANNER_KEYS.has(k)),
    [config], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">⚙️ Cấu hình</h1>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 800 }}>

        {/* ── Feature flags ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-card-title">🚦 Hiển thị trang</div>
            <div className="cfg-card-sub">Bật/tắt để ẩn trang với người dùng</div>
          </div>
          {PAGE_FLAGS.map(({ key, label, description }) => {
            const enabled = config[key] !== 'false';
            return (
              <div key={key} className="cfg-row">
                <div>
                  <div className="cfg-row-title">{label}</div>
                  <div className="cfg-row-sub">{description}</div>
                </div>
                <label className="cfg-toggle">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => handleToggle(key, e.target.checked)}
                  />
                  <span className="cfg-toggle-track">
                    <span className="cfg-toggle-thumb" />
                  </span>
                </label>
              </div>
            );
          })}
        </div>

        {/* ── Product-page banner ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-card-title">🖼️ Banner trang sản phẩm</div>
            <div className="cfg-card-sub">
              Banner nhỏ hiển thị trên đầu các trang sản phẩm. Khuyến nghị ảnh tỉ lệ 16:4 (vd 1600×400).
            </div>
          </div>

          <div className="cfg-row">
            <div>
              <div className="cfg-row-title">Bật banner trên tất cả các trang sản phẩm</div>
              <div className="cfg-row-sub">Có thể ghi đè theo từng trang ở phần dưới.</div>
            </div>
            <label className="cfg-toggle">
              <input
                type="checkbox"
                checked={bannerEnabled}
                onChange={e => setBannerEnabled(e.target.checked)}
              />
              <span className="cfg-toggle-track"><span className="cfg-toggle-thumb" /></span>
            </label>
          </div>

          <div className="cfg-section">
            <div className="cfg-section-title">Slide chung (áp dụng cho mọi trang ở chế độ "Kế thừa")</div>
            <SlideListEditor
              slides={globalSlides}
              onUpdate={updateGlobalSlide}
              onRemove={removeGlobalSlide}
              onMove={moveGlobalSlide}
              onAdd={addGlobalSlide}
              emptyHint="Chưa có slide chung. Bấm + Thêm slide để bắt đầu."
            />
          </div>
        </div>

        {/* ── Per-page overrides ── */}
        <div className="cfg-card">
          <div className="cfg-card-head">
            <div className="cfg-card-title">🎯 Ghi đè theo trang</div>
            <div className="cfg-card-sub">
              <strong>Kế thừa</strong> = dùng slide chung. <strong>Tuỳ chỉnh</strong> = trang này dùng slide riêng.
              <strong> Tắt</strong> = ẩn banner trên trang này dù banner chung đang bật.
            </div>
          </div>

          {BANNER_PAGES.map(({ slug, label }) => {
            const ovr = overrides[slug];
            return (
              <div key={slug} className="cfg-page-block">
                <div className="cfg-page-head">
                  <div className="cfg-row-title">{label}</div>
                  <div className="cfg-mode-radios">
                    {(['inherit', 'custom', 'disabled'] as const).map(m => (
                      <label key={m} className="cfg-mode-radio">
                        <input
                          type="radio"
                          name={`mode-${slug}`}
                          checked={ovr.mode === m}
                          onChange={() => setOverrideMode(slug, m)}
                        />
                        <span>{m === 'inherit' ? 'Kế thừa' : m === 'custom' ? 'Tuỳ chỉnh' : 'Tắt'}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {ovr.mode === 'custom' && (
                  <div className="cfg-section" style={{ marginTop: '0.75rem' }}>
                    <SlideListEditor
                      slides={ovr.slides ?? []}
                      onUpdate={(idx, patch)  => updateOverrideSlide(slug, idx, patch)}
                      onRemove={(idx)          => removeOverrideSlide(slug, idx)}
                      onMove={(idx, dir)       => moveOverrideSlide(slug, idx, dir)}
                      onAdd={(slide)            => addOverrideSlide(slug, slide)}
                      emptyHint="Chưa có slide riêng — trang này sẽ ẩn banner cho đến khi bạn thêm slide."
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Other config ── */}
        {otherEntries.length > 0 && (
          <div className="cfg-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div className="cfg-card-title" style={{ marginBottom: '1rem' }}>🔧 Cấu hình khác</div>
            {otherEntries.map(([key, value]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{key}</label>
                <input
                  className="form-input"
                  value={value}
                  onChange={e => handleChange(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
          {saved && <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Đã lưu!</span>}
        </div>
      </form>
    </div>
  );
}

// ── Sub-component: slide list editor (used by global + each per-page custom) ─
interface SlideListEditorProps {
  slides:   BannerSlide[];
  onUpdate: (idx: number, patch: Partial<BannerSlide>) => void;
  onRemove: (idx: number) => void;
  onMove:   (idx: number, dir: -1 | 1) => void;
  onAdd:    (slide: BannerSlide) => void;
  emptyHint: string;
}

function SlideListEditor({ slides, onUpdate, onRemove, onMove, onAdd, emptyHint }: SlideListEditorProps) {
  const addInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAdd, setUploadingAdd] = useState(false);

  const handleAddUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAdd(true);
    try {
      const upload = await uploadApi.productBanner(Array.from(files));
      for (const url of upload.data.urls ?? []) {
        onAdd({ imageUrl: url });
      }
    } catch {
      alert('Lỗi khi tải ảnh');
    } finally {
      setUploadingAdd(false);
      if (addInputRef.current) addInputRef.current.value = '';
    }
  };

  return (
    <div className="cfg-slides">
      {slides.length === 0 && (
        <div className="cfg-slides-empty">{emptyHint}</div>
      )}

      {slides.map((s, idx) => (
        <SlideRow
          key={`${s.imageUrl}-${idx}`}
          slide={s}
          index={idx}
          total={slides.length}
          onUpdate={patch => onUpdate(idx, patch)}
          onRemove={() => onRemove(idx)}
          onMove={dir => onMove(idx, dir)}
        />
      ))}

      <div>
        <input
          ref={addInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddUpload}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => addInputRef.current?.click()}
          disabled={uploadingAdd}
        >
          {uploadingAdd ? 'Đang tải...' : '+ Thêm slide'}
        </button>
      </div>
    </div>
  );
}

interface SlideRowProps {
  slide:    BannerSlide;
  index:    number;
  total:    number;
  onUpdate: (patch: Partial<BannerSlide>) => void;
  onRemove: () => void;
  onMove:   (dir: -1 | 1) => void;
}

function SlideRow({ slide, index, total, onUpdate, onRemove, onMove }: SlideRowProps) {
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [uploadingReplace, setUploadingReplace] = useState(false);

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReplace(true);
    try {
      const upload = await uploadApi.productBanner([file]);
      const url = upload.data.urls?.[0];
      if (url) {
        const previous = slide.imageUrl;
        onUpdate({ imageUrl: url });
        // Best-effort cleanup of the previous image (parent's purgeIfUnsaved
        // protects already-persisted ones via its own snapshot check).
        if (previous && previous !== url) uploadApi.deleteMany([previous]);
      }
    } catch {
      alert('Lỗi khi tải ảnh');
    } finally {
      setUploadingReplace(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  return (
    <div className="cfg-slide-row">
      <img src={slide.imageUrl} alt="" className="cfg-slide-thumb" />

      <div className="cfg-slide-fields">
        <label className="form-label" style={{ fontSize: '0.78rem' }}>Link khi click (tuỳ chọn)</label>
        <input
          className="form-input"
          value={slide.linkUrl ?? ''}
          onChange={e => onUpdate({ linkUrl: e.target.value })}
          placeholder="VD: /thiep hoặc https://..."
        />
      </div>

      <div className="cfg-slide-actions">
        <input
          ref={replaceInputRef}
          type="file"
          accept="image/*"
          onChange={handleReplace}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button type="button" className="btn-edit" onClick={() => onMove(-1)} disabled={index === 0}          title="Lên">↑</button>
          <button type="button" className="btn-edit" onClick={() => onMove(+1)} disabled={index === total - 1} title="Xuống">↓</button>
        </div>
        <button
          type="button"
          className="btn-edit"
          onClick={() => replaceInputRef.current?.click()}
          disabled={uploadingReplace}
        >
          {uploadingReplace ? '...' : 'Thay ảnh'}
        </button>
        <button type="button" className="btn-danger" onClick={onRemove}>Xoá</button>
      </div>
    </div>
  );
}

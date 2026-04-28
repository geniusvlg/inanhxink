import { useEffect, useRef, useState } from 'react';
import { bannersApi, metadataApi, uploadApi } from '../services/api';
import { type Banner } from '../types';
import { resolveAssetUrl } from '../utils/assetUrl';
import '../components/Layout.css';
import './BannersPage.css';
import './ConfigPage.css';

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
  } catch { return []; }
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

// ── Homepage banner form type ────────────────────────────────────────────────

type EditForm = {
  image_url: string;
  link_url:  string;
  alt_text:  string;
  is_active: boolean;
};

const emptyForm = (): EditForm => ({
  image_url: '',
  link_url:  '',
  alt_text:  '',
  is_active: true,
});

// ── Main component ───────────────────────────────────────────────────────────

export default function BannersPage() {
  // ── Homepage banners (banners table) ──────────────────────────────────────
  const [items,     setItems]     = useState<Banner[]>([]);
  const [loadingHP, setLoadingHP] = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [editing,   setEditing]   = useState<Banner | null>(null);
  const [form,      setForm]      = useState<EditForm>(emptyForm());
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Product-page banner (metadata table) ──────────────────────────────────
  const [loadingPB,     setLoadingPB]     = useState(true);
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [globalSlides,  setGlobalSlides]  = useState<BannerSlide[]>([]);
  const [overrides,     setOverrides]     = useState<Overrides>(DEFAULT_OVERRIDES);
  const [savingPB,      setSavingPB]      = useState(false);
  const [savedPB,       setSavedPB]       = useState(false);
  const originalUrlsRef = useRef<Set<string>>(new Set());

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadHomepage = () => {
    setLoadingHP(true);
    bannersApi.list()
      .then(r => setItems(r.data.banners ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoadingHP(false));
  };

  useEffect(() => {
    loadHomepage();
    metadataApi.get()
      .then(r => {
        const cfg = r.data.config ?? {};
        const slides = parseSlides(cfg.product_banner_slides);
        const ovr    = parseOverrides(cfg.product_banner_overrides);
        setBannerEnabled(cfg.product_banner_enabled === 'true');
        setGlobalSlides(slides);
        setOverrides(ovr);
        originalUrlsRef.current = collectImageUrls(slides, ovr);
      })
      .finally(() => setLoadingPB(false));
  }, []);

  // ── Homepage banner mutations ─────────────────────────────────────────────
  const openCreate = () => { setCreating(true); setEditing(null); setForm(emptyForm()); };
  const openEdit   = (b: Banner) => {
    setCreating(false);
    setEditing(b);
    setForm({ image_url: b.image_url, link_url: b.link_url ?? '', alt_text: b.alt_text ?? '', is_active: b.is_active });
  };

  const closeModal = (discardUnsaved = true) => {
    const original = editing?.image_url ?? '';
    if (discardUnsaved && form.image_url && form.image_url !== original) {
      uploadApi.deleteMany([form.image_url]);
    }
    setCreating(false); setEditing(null); setForm(emptyForm());
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = await uploadApi.banners([file]);
      const url = upload.data.urls?.[0];
      if (url) {
        const previous = form.image_url;
        const original = editing?.image_url ?? '';
        if (previous && previous !== url && previous !== original) uploadApi.deleteMany([previous]);
        setForm(f => ({ ...f, image_url: url }));
      }
    } catch { alert('Lỗi khi tải ảnh'); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveHP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image_url) { alert('Vui lòng chọn ảnh banner'); return; }
    setSaving(true);
    try {
      const payload = { image_url: form.image_url, link_url: form.link_url.trim() || null, alt_text: form.alt_text.trim() || null, is_active: form.is_active };
      if (editing) { await bannersApi.update(editing.id, payload); }
      else         { await bannersApi.create(payload); }
      closeModal(false);
      loadHomepage();
    } catch { alert('Lỗi khi lưu'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (b: Banner) => {
    setItems(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
    try { await bannersApi.update(b.id, { is_active: !b.is_active }); loadHomepage(); }
    catch { alert('Lỗi khi cập nhật'); loadHomepage(); }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[idx]; const b = items[target];
    const next = items.slice();
    next[idx] = { ...a, sort_order: b.sort_order };
    next[target] = { ...b, sort_order: a.sort_order };
    setItems(next);
    try { await bannersApi.reorder([{ id: a.id, sort_order: b.sort_order }, { id: b.id, sort_order: a.sort_order }]); loadHomepage(); }
    catch { alert('Lỗi khi sắp xếp'); loadHomepage(); }
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm('Xoá banner này?')) return;
    try { await bannersApi.delete(b.id); loadHomepage(); }
    catch { alert('Lỗi khi xoá'); }
  };

  // ── Product-page banner mutations ─────────────────────────────────────────
  const purgeIfUnsaved = (url: string) => {
    if (url && !originalUrlsRef.current.has(url)) uploadApi.deleteMany([url]);
  };

  const updateGlobalSlide = (idx: number, patch: Partial<BannerSlide>) =>
    setGlobalSlides(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const removeGlobalSlide = (idx: number) =>
    setGlobalSlides(prev => { const removed = prev[idx]; if (removed) purgeIfUnsaved(removed.imageUrl); return prev.filter((_, i) => i !== idx); });

  const moveGlobalSlide = (idx: number, dir: -1 | 1) =>
    setGlobalSlides(prev => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice(); [next[idx], next[target]] = [next[target], next[idx]]; return next;
    });

  const addGlobalSlide = (slide: BannerSlide) => setGlobalSlides(prev => [...prev, slide]);

  const setOverrideMode = (slug: ProductPageSlug, mode: BannerMode) =>
    setOverrides(prev => {
      const cur = prev[slug];
      if (cur.mode === 'custom' && mode !== 'custom' && cur.slides) {
        for (const s of cur.slides) purgeIfUnsaved(s.imageUrl);
      }
      const next: BannerOverride = mode === 'custom' ? { mode, slides: cur.slides ?? [] } : { mode };
      return { ...prev, [slug]: next };
    });

  const updateOverrideSlide = (slug: ProductPageSlug, idx: number, patch: Partial<BannerSlide>) =>
    setOverrides(prev => {
      const cur = prev[slug];
      const slides = (cur.slides ?? []).map((s, i) => i === idx ? { ...s, ...patch } : s);
      return { ...prev, [slug]: { ...cur, slides } };
    });

  const removeOverrideSlide = (slug: ProductPageSlug, idx: number) =>
    setOverrides(prev => {
      const cur = prev[slug];
      const removed = cur.slides?.[idx];
      if (removed) purgeIfUnsaved(removed.imageUrl);
      const slides = (cur.slides ?? []).filter((_, i) => i !== idx);
      return { ...prev, [slug]: { ...cur, slides } };
    });

  const moveOverrideSlide = (slug: ProductPageSlug, idx: number, dir: -1 | 1) =>
    setOverrides(prev => {
      const cur = prev[slug];
      const target = idx + dir;
      const slides = cur.slides ?? [];
      if (target < 0 || target >= slides.length) return prev;
      const next = slides.slice(); [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, [slug]: { ...cur, slides: next } };
    });

  const addOverrideSlide = (slug: ProductPageSlug, slide: BannerSlide) =>
    setOverrides(prev => { const cur = prev[slug]; return { ...prev, [slug]: { ...cur, slides: [...(cur.slides ?? []), slide] } }; });

  const handleSavePB = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPB(true);
    try {
      await metadataApi.update({
        product_banner_enabled:   bannerEnabled ? 'true' : 'false',
        product_banner_slides:    JSON.stringify(globalSlides),
        product_banner_overrides: JSON.stringify(overrides),
      });
      const currentUrls = collectImageUrls(globalSlides, overrides);
      const orphans = Array.from(originalUrlsRef.current).filter(u => !currentUrls.has(u));
      if (orphans.length > 0) uploadApi.deleteMany(orphans);
      originalUrlsRef.current = currentUrls;
      setSavedPB(true);
      setTimeout(() => setSavedPB(false), 2000);
    } catch { alert('Lỗi khi lưu cấu hình'); }
    finally { setSavingPB(false); }
  };

  const modalOpen = creating || editing !== null;

  return (
    <div>
      {/* ══ Section 1: Homepage banners ══════════════════════════════════════ */}
      <div className="admin-page-header">
        <h1 className="admin-page-title">🖼️ Banner trang chủ</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm banner</button>
      </div>

      <div className="admin-table-wrap">
        {loadingHP ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '12rem' }}>Ảnh</th>
                <th>Link khi click</th>
                <th>Mô tả (alt)</th>
                <th style={{ textAlign: 'center' }}>Hiển thị</th>
                <th style={{ width: '7rem' }}>Sắp xếp</th>
                <th style={{ width: '12rem' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Chưa có banner nào</td></tr>
              )}
              {items.map((b, idx) => (
                <tr key={b.id}>
                  <td>
                    <a href={b.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={resolveAssetUrl(b.image_url)} alt={b.alt_text ?? ''} className="banner-thumb" />
                    </a>
                  </td>
                  <td className="banner-link-cell">
                    {b.link_url ? <a href={b.link_url} target="_blank" rel="noopener noreferrer">{b.link_url}</a> : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td>{b.alt_text || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="banner-toggle-btn" onClick={() => toggleActive(b)} title={b.is_active ? 'Bấm để ẩn' : 'Bấm để hiện'}>
                      {b.is_active ? '✅' : '🚫'}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn-edit" onClick={() => move(idx, -1)} disabled={idx === 0} title="Lên">↑</button>
                      <button className="btn-edit" onClick={() => move(idx, +1)} disabled={idx === items.length - 1} title="Xuống">↓</button>
                    </div>
                  </td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-edit"   onClick={() => openEdit(b)}>Sửa</button>
                    <button className="btn-danger" onClick={() => handleDelete(b)}>Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ══ Section 2: Product-page banner ═══════════════════════════════════ */}
      <div style={{ marginTop: '2.5rem' }}>
        <div className="admin-page-header">
          <h2 className="admin-page-title" style={{ fontSize: '1.1rem' }}>🎯 Banner trang sản phẩm</h2>
        </div>

        {loadingPB ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</div>
        ) : (
          <form onSubmit={handleSavePB} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: 800 }}>

            {/* Global toggle + slides */}
            <div className="cfg-card">
              <div className="cfg-card-head">
                <div className="cfg-card-title">🖼️ Banner trang sản phẩm</div>
                <div className="cfg-card-sub">Banner nhỏ hiển thị trên đầu các trang sản phẩm. Khuyến nghị ảnh tỉ lệ 16:4 (vd 1600×400).</div>
              </div>

              <div className="cfg-row">
                <div>
                  <div className="cfg-row-title">Bật banner trên tất cả các trang sản phẩm</div>
                  <div className="cfg-row-sub">Có thể ghi đè theo từng trang ở phần dưới.</div>
                </div>
                <label className="cfg-toggle">
                  <input type="checkbox" checked={bannerEnabled} onChange={e => setBannerEnabled(e.target.checked)} />
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

            {/* Per-page overrides */}
            <div className="cfg-card">
              <div className="cfg-card-head">
                <div className="cfg-card-title">🎯 Ghi đè theo trang</div>
                <div className="cfg-card-sub">
                  <strong>Kế thừa</strong> = dùng slide chung. <strong>Tuỳ chỉnh</strong> = trang này dùng slide riêng. <strong>Tắt</strong> = ẩn banner trên trang này.
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
                            <input type="radio" name={`mode-${slug}`} checked={ovr.mode === m} onChange={() => setOverrideMode(slug, m)} />
                            <span>{m === 'inherit' ? 'Kế thừa' : m === 'custom' ? 'Tuỳ chỉnh' : 'Tắt'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    {ovr.mode === 'custom' && (
                      <div className="cfg-section" style={{ marginTop: '0.75rem' }}>
                        <SlideListEditor
                          slides={ovr.slides ?? []}
                          onUpdate={(idx, patch) => updateOverrideSlide(slug, idx, patch)}
                          onRemove={(idx)        => removeOverrideSlide(slug, idx)}
                          onMove={(idx, dir)     => moveOverrideSlide(slug, idx, dir)}
                          onAdd={(slide)          => addOverrideSlide(slug, slide)}
                          emptyHint="Chưa có slide riêng — trang này sẽ ẩn banner cho đến khi bạn thêm slide."
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button type="submit" className="btn-primary" disabled={savingPB}>
                {savingPB ? 'Đang lưu...' : 'Lưu banner trang sản phẩm'}
              </button>
              {savedPB && <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Đã lưu!</span>}
            </div>
          </form>
        )}
      </div>

      {/* ══ Homepage banner modal ═════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => closeModal()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Sửa banner' : 'Thêm banner mới'}</h2>
            <form onSubmit={handleSaveHP}>
              <div className="form-group">
                <label className="form-label">Ảnh banner *</label>
                <div className="banner-image-edit">
                  {form.image_url
                    ? <img src={resolveAssetUrl(form.image_url)} alt="" className="banner-image-preview" />
                    : <div className="banner-image-placeholder">Chưa có ảnh</div>}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUploadImage} style={{ display: 'none' }} />
                  <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? 'Đang tải...' : (form.image_url ? 'Thay ảnh' : 'Tải ảnh lên')}
                  </button>
                </div>
                <p className="form-hint">Khuyến nghị: ảnh tỷ lệ 16:6 (vd 1600×600), &lt; 1 MB.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Link khi click (tuỳ chọn)</label>
                <input className="form-input" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="VD: /thiep hoặc https://..." />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả (alt) (tuỳ chọn)</label>
                <input className="form-input" value={form.alt_text} onChange={e => setForm(f => ({ ...f, alt_text: e.target.value }))} placeholder="VD: Khuyến mãi tháng 4" />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="b_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="b_active" className="form-label" style={{ margin: 0 }}>Hiển thị trên trang chủ</label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => closeModal()}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving || !form.image_url}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SlideListEditor ──────────────────────────────────────────────────────────

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
      for (const url of upload.data.urls ?? []) onAdd({ imageUrl: url });
    } catch { alert('Lỗi khi tải ảnh'); }
    finally { setUploadingAdd(false); if (addInputRef.current) addInputRef.current.value = ''; }
  };

  return (
    <div className="cfg-slides">
      {slides.length === 0 && <div className="cfg-slides-empty">{emptyHint}</div>}
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
        <input ref={addInputRef} type="file" accept="image/*" multiple onChange={handleAddUpload} style={{ display: 'none' }} />
        <button type="button" className="btn-secondary" onClick={() => addInputRef.current?.click()} disabled={uploadingAdd}>
          {uploadingAdd ? 'Đang tải...' : '+ Thêm slide'}
        </button>
      </div>
    </div>
  );
}

// ── SlideRow ─────────────────────────────────────────────────────────────────

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
        if (previous && previous !== url) uploadApi.deleteMany([previous]);
      }
    } catch { alert('Lỗi khi tải ảnh'); }
    finally { setUploadingReplace(false); if (replaceInputRef.current) replaceInputRef.current.value = ''; }
  };

  return (
    <div className="cfg-slide-row">
      <img src={resolveAssetUrl(slide.imageUrl)} alt="" className="cfg-slide-thumb" />
      <div className="cfg-slide-fields">
        <label className="form-label" style={{ fontSize: '0.78rem' }}>Link khi click (tuỳ chọn)</label>
        <input className="form-input" value={slide.linkUrl ?? ''} onChange={e => onUpdate({ linkUrl: e.target.value })} placeholder="VD: /thiep hoặc https://..." />
      </div>
      <div className="cfg-slide-actions">
        <input ref={replaceInputRef} type="file" accept="image/*" onChange={handleReplace} style={{ display: 'none' }} />
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button type="button" className="btn-edit" onClick={() => onMove(-1)} disabled={index === 0}          title="Lên">↑</button>
          <button type="button" className="btn-edit" onClick={() => onMove(+1)} disabled={index === total - 1} title="Xuống">↓</button>
        </div>
        <button type="button" className="btn-edit" onClick={() => replaceInputRef.current?.click()} disabled={uploadingReplace}>
          {uploadingReplace ? '...' : 'Thay ảnh'}
        </button>
        <button type="button" className="btn-danger" onClick={onRemove}>Xoá</button>
      </div>
    </div>
  );
}

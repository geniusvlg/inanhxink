import { useState, useEffect, useMemo } from 'react';
import { metadataApi } from '../services/api';
import '../components/Layout.css';
import './ConfigPage.css';

const PAGE_FLAGS: { key: string; label: string; description: string }[] = [
  { key: 'page_qr_yeu_thuong',     label: 'QR Yêu Thương',      description: 'Trang tạo QR code cá nhân' },
  { key: 'page_thiep',             label: 'Thiệp',              description: 'Trang sản phẩm thiệp' },
  { key: 'page_khung_anh',         label: 'Khung Ảnh',          description: 'Trang sản phẩm khung ảnh' },
  { key: 'page_so_scrapbook',      label: 'Sổ & Scrapbook',     description: 'Trang sản phẩm sổ và phụ kiện scrapbook' },
  { key: 'page_set_qua_tang',      label: 'Set Quà Tặng',       description: 'Trang sản phẩm set quà tặng' },
  { key: 'page_cac_san_pham_khac', label: 'Các Sản Phẩm Khác', description: 'Trang các sản phẩm khác' },
  { key: 'page_in_anh',            label: 'In Ảnh',            description: 'Trang dịch vụ in ảnh' },
  { key: 'page_order_tracking',    label: 'Tra cứu đơn hàng',   description: 'Trang khách hàng tra cứu đơn theo mã invoice' },
  { key: 'page_danh_gia',          label: 'Feedback',           description: 'Trang đánh giá / phản hồi khách hàng' },
];

const PAGE_ORDER_KEY = 'page_order';
const DEFAULT_PAGE_ORDER = PAGE_FLAGS.map(f => f.key);

// Keys managed by other pages — exclude from "other config" and don't
// overwrite them when ConfigPage saves.
const MANAGED_ELSEWHERE = new Set([
  'product_banner_enabled',
  'product_banner_slides',
  'product_banner_overrides',
  'in_anh_price_image_url',
  'in_anh_sample_image_url',
  'in_anh_sizes',
  'in_anh_gallery',
]);

export default function ConfigPage() {
  const [config,  setConfig]  = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    metadataApi.get()
      .then(r => setConfig(r.data.config ?? {}))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (key: string, enabled: boolean) =>
    setConfig(c => ({ ...c, [key]: enabled ? 'true' : 'false' }));

  const handleChange = (key: string, value: string) =>
    setConfig(c => ({ ...c, [key]: value }));

  const normalizePageOrder = (raw?: string) => {
    if (!raw) return DEFAULT_PAGE_ORDER;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return DEFAULT_PAGE_ORDER;
      const known = new Set(DEFAULT_PAGE_ORDER);
      const ordered = parsed.filter((v): v is string => typeof v === 'string' && known.has(v));
      for (const key of DEFAULT_PAGE_ORDER) {
        if (!ordered.includes(key)) ordered.push(key);
      }
      return ordered;
    } catch {
      return DEFAULT_PAGE_ORDER;
    }
  };

  const orderedPageFlags = normalizePageOrder(config[PAGE_ORDER_KEY]);

  const movePage = (key: string, direction: -1 | 1) => {
    const order = [...orderedPageFlags];
    const index = order.indexOf(key);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    setConfig(c => ({ ...c, [PAGE_ORDER_KEY]: JSON.stringify(order) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Only send keys that ConfigPage manages — never overwrite banner / in-anh keys.
      const payload: Record<string, string> = { ...config };
      for (const k of MANAGED_ELSEWHERE) delete payload[k];
      payload[PAGE_ORDER_KEY] = JSON.stringify(orderedPageFlags);
      await metadataApi.update(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  const pageFlagKeys = new Set(PAGE_FLAGS.map(f => f.key));
  const otherEntries = useMemo(
    () => Object.entries(config).filter(([k]) => k !== PAGE_ORDER_KEY && !pageFlagKeys.has(k) && !MANAGED_ELSEWHERE.has(k)),
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
          {orderedPageFlags.map((key, index) => {
            const page = PAGE_FLAGS.find(f => f.key === key);
            if (!page) return null;
            const { label, description } = page;
            const enabled = config[key] !== 'false';
            return (
              <div key={key} className="cfg-row">
                <div>
                  <div className="cfg-row-title">{label}</div>
                  <div className="cfg-row-sub">{description}</div>
                </div>
                <div className="cfg-row-actions">
                  <button type="button" className="cfg-order-btn" disabled={index === 0} onClick={() => movePage(key, -1)}>
                    ↑
                  </button>
                  <button type="button" className="cfg-order-btn" disabled={index === orderedPageFlags.length - 1} onClick={() => movePage(key, 1)}>
                    ↓
                  </button>
                  <label className="cfg-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={e => handleToggle(key, e.target.checked)}
                    />
                    <span className="cfg-toggle-track"><span className="cfg-toggle-thumb" /></span>
                  </label>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Other config keys ── */}
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

import { useState, useEffect } from 'react';
import { metadataApi } from '../services/api';
import '../components/Layout.css';

const PAGE_FLAGS: { key: string; label: string; description: string }[] = [
  { key: 'page_qr_yeu_thuong',     label: 'QR Yêu Thương',      description: 'Trang tạo QR code cá nhân' },
  { key: 'page_thiep',             label: 'Thiệp',              description: 'Trang sản phẩm thiệp' },
  { key: 'page_khung_anh',         label: 'Khung Ảnh',          description: 'Trang sản phẩm khung ảnh' },
  { key: 'page_so_scrapbook',      label: 'Sổ & Scrapbook',     description: 'Trang sản phẩm sổ và phụ kiện scrapbook' },
  { key: 'page_cac_san_pham_khac', label: 'Các Sản Phẩm Khác', description: 'Trang các sản phẩm khác' },
];

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

  const handleToggle = (key: string, enabled: boolean) => {
    setConfig(c => ({ ...c, [key]: enabled ? 'true' : 'false' }));
  };

  const handleChange = (key: string, value: string) => {
    setConfig(c => ({ ...c, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await metadataApi.update(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      alert('Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Separate page flags from other config keys
  const pageFlagKeys = new Set(PAGE_FLAGS.map(f => f.key));
  const otherEntries = Object.entries(config).filter(([k]) => !pageFlagKeys.has(k));

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">⚙️ Cấu hình</h1>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 640 }}>

        {/* ── Feature flags ── */}
        <div style={{ background: '#fff', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a' }}>🚦 Hiển thị trang</div>
            <div style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.2rem' }}>Bật/tắt để ẩn trang với người dùng</div>
          </div>
          {PAGE_FLAGS.map(({ key, label, description }) => {
            const enabled = config[key] !== 'false';
            return (
              <div
                key={key}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.5rem', borderBottom: '1px solid #f8fafc' }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{label}</div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{description}</div>
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

        {/* ── Other config ── */}
        {otherEntries.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)', padding: '1.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#0f172a', marginBottom: '1rem' }}>🔧 Cấu hình khác</div>
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

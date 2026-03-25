import { useState, useEffect } from 'react';
import { metadataApi } from '../services/api';
import '../components/Layout.css';

export default function ConfigPage() {
  const [config, setConfig]   = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    metadataApi.get()
      .then(r => setConfig(r.data.config))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">⚙️ Cấu hình</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,.08)', padding: '1.5rem', maxWidth: 600 }}>
        <form onSubmit={handleSave}>
          {Object.entries(config).map(([key, value]) => (
            <div className="form-group" key={key}>
              <label className="form-label">{key}</label>
              <input
                className="form-input"
                value={value}
                onChange={e => handleChange(key, e.target.value)}
              />
            </div>
          ))}

          {Object.keys(config).length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
              Chưa có cấu hình nào.
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
            {saved && <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Đã lưu!</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

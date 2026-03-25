import { useState, useEffect } from 'react';
import { templatesApi } from '../services/api';
import { type Template } from '../types';
import '../components/Layout.css';

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function ProductsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const load = () => {
    setLoading(true);
    templatesApi.list()
      .then(r => setTemplates(r.data.templates ?? []))
      .catch(() => setError('Không thể tải danh sách template'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleToggle = async (t: Template) => {
    await templatesApi.update(t.id, { is_active: !t.is_active });
    load();
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;
  if (error)   return <div className="admin-error">{error}</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <QrIcon /> QR Templates
        </h1>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên</th>
              <th>Loại template</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {templates.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>
                  <strong>{t.name}</strong>
                  {t.description && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.description}</div>}
                </td>
                <td>
                  <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                    {t.template_type}
                  </code>
                </td>
                <td>{t.price.toLocaleString('vi-VN')}đ</td>
                <td>
                  <span className={`badge ${t.is_active ? 'badge-green' : 'badge-red'}`}>
                    {t.is_active ? 'Đang bán' : 'Ẩn'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.825rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => handleToggle(t)}
                  >
                    {t.is_active ? 'Ẩn' : 'Hiện'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

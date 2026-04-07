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

type FormState = {
  name: string;
  description: string;
  image_url: string;
  price: string;
  template_type: string;
  is_active: boolean;
  demo_url: string;
};

const emptyForm = (): FormState => ({
  name: '',
  description: '',
  image_url: '',
  price: '',
  template_type: '',
  is_active: true,
  demo_url: '',
});

export default function ProductsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Template | null>(null);
  const [form, setForm]           = useState<FormState>(emptyForm());
  const [saving, setSaving]       = useState(false);

  const load = () => {
    setLoading(true);
    templatesApi.list()
      .then(r => setTemplates(r.data.templates ?? []))
      .catch(() => setError('Không thể tải danh sách template'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({
      name:          t.name,
      description:   t.description ?? '',
      image_url:     t.image_url ?? '',
      price:         String(t.price),
      template_type: t.template_type,
      is_active:     t.is_active,
      demo_url:      t.demo_url ?? '',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:          form.name.trim(),
        description:   form.description.trim() || null,
        image_url:     form.image_url.trim() || null,
        price:         parseFloat(form.price),
        template_type: form.template_type.trim(),
        is_active:     form.is_active,
        demo_url:      form.demo_url.trim() || null,
      };
      if (editing) {
        await templatesApi.update(editing.id, payload);
      } else {
        await templatesApi.create(payload);
      }
      closeModal();
      load();
    } catch {
      alert('Lỗi khi lưu template');
    } finally {
      setSaving(false);
    }
  };

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
        <button className="btn-primary" onClick={openCreate}>+ Thêm mới</button>
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
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: '0.825rem', padding: '0.35rem 0.75rem' }}
                    onClick={() => openEdit(t)}
                  >
                    Sửa
                  </button>
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

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Sửa template' : 'Thêm template'}</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <label className="form-label">Tên * <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(tối đa 50 ký tự)</span></label>
              <input
                className="form-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={50}
                required
              />

              <label className="form-label">Mô tả</label>
              <textarea
                className="form-input"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />

              <label className="form-label">Loại template * <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(loveletter, letterinspace…)</span></label>
              <input
                className="form-input"
                value={form.template_type}
                onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))}
                required
              />

              <label className="form-label">Giá (đ) *</label>
              <input
                className="form-input"
                type="number"
                min={0}
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                required
              />

              <label className="form-label">URL ảnh</label>
              <input
                className="form-input"
                placeholder="/templates/loveletter/thumbnail.jpg"
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              />

              <label className="form-label">URL Demo <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(để trống nếu không có)</span></label>
              <input
                className="form-input"
                placeholder="https://..."
                value={form.demo_url}
                onChange={e => setForm(f => ({ ...f, demo_url: e.target.value }))}
              />

              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                Đang bán
              </label>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={closeModal}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu…' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { productCategoriesApi } from '../services/api';
import { type ProductCategory } from '../types';
import '../components/Layout.css';

const TYPE_LABEL: Record<string, string> = {
  thiep:     '🎴 Thiệp',
  khung_anh: '🖼️ Khung Ảnh',
};

const TYPES = ['thiep', 'khung_anh'] as const;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [form, setForm]             = useState({ name: '', type: 'thiep' as 'thiep' | 'khung_anh' });
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all(TYPES.map(t => productCategoriesApi.list(t)))
      .then(([thiep, khung]) => {
        setCategories([
          ...(thiep.data.categories ?? []),
          ...(khung.data.categories ?? []),
        ]);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({ name: '', type: 'thiep' }); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await productCategoriesApi.create(form);
      closeModal();
      load();
    } catch {
      alert('Lỗi khi thêm danh mục');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: ProductCategory) => {
    if (!confirm(`Xoá danh mục "${c.name}"? Các sản phẩm thuộc danh mục này sẽ bị bỏ liên kết.`)) return;
    try {
      await productCategoriesApi.delete(c.id);
      load();
    } catch {
      alert('Lỗi khi xoá danh mục');
    }
  };

  const grouped = TYPES.reduce<Record<string, ProductCategory[]>>((acc, t) => {
    acc[t] = categories.filter(c => c.type === t);
    return acc;
  }, { thiep: [], khung_anh: [] });

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🏷️ Danh mục</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm danh mục</button>
      </div>

      {TYPES.map(t => (
        <div key={t} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>
            {TYPE_LABEL[t]}
          </h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tên danh mục</th>
                  <th>Loại</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {grouped[t].length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      Chưa có danh mục nào
                    </td>
                  </tr>
                )}
                {grouped[t].map(c => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td><strong>{c.name}</strong></td>
                    <td><span className="badge badge-blue">{TYPE_LABEL[c.type]}</span></td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(c)}>Xoá</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Thêm danh mục mới</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Tên danh mục *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Sinh nhật"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Loại *</label>
                <select
                  className="form-input"
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as 'thiep' | 'khung_anh' }))}
                >
                  {TYPES.map(t => (
                    <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Thêm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

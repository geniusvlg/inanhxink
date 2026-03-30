import { useState, useEffect } from 'react';
import { productCategoriesApi } from '../services/api';
import { type ProductCategory } from '../types';
import '../components/Layout.css';

const PRODUCT_TYPES = [
  { value: 'thiep',        label: 'Thiệp' },
  { value: 'khung_anh',    label: 'Khung Ảnh' },
  { value: 'so_scrapbook', label: 'Sổ & Scrapbook' },
  { value: 'set-qua-tang', label: 'Set Quà Tặng' },
  { value: 'khac',         label: 'Các Sản Phẩm Khác' },
];

const typeLabel = (type: string) =>
  PRODUCT_TYPES.find(t => t.value === type)?.label ?? type;

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [name, setName]             = useState('');
  const [type, setType]             = useState('thiep');
  const [saving, setSaving]         = useState(false);

  const load = () => {
    setLoading(true);
    productCategoriesApi.list()
      .then(r => setCategories(r.data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setName(''); setType('thiep'); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await productCategoriesApi.create({ name, type });
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

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🏷️ Danh mục</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm danh mục</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tên danh mục</th>
              <th>Loại sản phẩm</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  Chưa có danh mục nào
                </td>
              </tr>
            )}
            {categories.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td><strong>{c.name}</strong></td>
                <td>{typeLabel(c.type)}</td>
                <td>
                  <button className="btn-danger" onClick={() => handleDelete(c)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Thêm danh mục mới</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Loại sản phẩm *</label>
                <select
                  className="form-input"
                  value={type}
                  onChange={e => setType(e.target.value)}
                  required
                >
                  {PRODUCT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tên danh mục *</label>
                <input
                  className="form-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Sinh nhật"
                  autoFocus
                  required
                />
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

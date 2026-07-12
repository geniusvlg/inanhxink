import { useRef, useState, useEffect } from 'react';
import { productCategoriesApi, uploadApi } from '../services/api';
import { type ProductCategory } from '../types';
import { resolveAssetUrl } from '../utils/assetUrl';
import '../components/Layout.css';
import './CategoriesPage.css';

const PRODUCT_TYPES = [
  { value: 'thiep',        label: 'Thiệp' },
  { value: 'khung_anh',    label: 'Khung Ảnh' },
  { value: 'so_scrapbook', label: 'Sổ & Scrapbook' },
  { value: 'set-qua-tang', label: 'Set Quà Tặng' },
  { value: 'khac',         label: 'Các Sản Phẩm Khác' },
  { value: 'in_anh',       label: 'In Ảnh' },
];

const typeLabel = (type?: string) =>
  type ? (PRODUCT_TYPES.find(t => t.value === type)?.label ?? type) : 'Chung';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [name, setName]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = () => {
    setLoading(true);
    productCategoriesApi.list()
      .then(r => setCategories(r.data.categories ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setName(''); setShowModal(true); };
  const closeModal = () => setShowModal(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await productCategoriesApi.create({ name });
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

  const toggleActive = async (c: ProductCategory) => {
    setCategories(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x));
    try {
      await productCategoriesApi.update(c.id, { is_active: !c.is_active });
    } catch {
      alert('Lỗi khi cập nhật');
      load();
    }
  };

  const handleUploadImage = async (c: ProductCategory, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingId(c.id);
    try {
      const upload = await uploadApi.categoryImage([file]);
      const url = upload.data.urls?.[0];
      if (url) {
        await productCategoriesApi.update(c.id, { image_url: url });
        load();
      }
    } catch {
      alert('Lỗi khi tải ảnh');
    } finally {
      setUploadingId(null);
      const input = fileInputRefs.current[c.id];
      if (input) input.value = '';
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
              <th>Ảnh</th>
              <th>Tên danh mục</th>
              <th>Phạm vi</th>
              <th style={{ textAlign: 'center' }}>Hiển thị</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  Chưa có danh mục nào
                </td>
              </tr>
            )}
            {categories.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>
                  <div className="cat-thumb-cell">
                    {c.image_url
                      ? <img src={resolveAssetUrl(c.image_url)} alt="" className="cat-thumb" />
                      : <div className="cat-thumb cat-thumb--empty">—</div>}
                    <input
                      ref={el => { fileInputRefs.current[c.id] = el; }}
                      type="file"
                      accept="image/*"
                      onChange={e => handleUploadImage(c, e)}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => fileInputRefs.current[c.id]?.click()}
                      disabled={uploadingId === c.id}
                    >
                      {uploadingId === c.id ? 'Đang tải...' : (c.image_url ? 'Thay ảnh' : 'Tải ảnh')}
                    </button>
                  </div>
                </td>
                <td><strong>{c.name}</strong></td>
                <td>{typeLabel(c.type)}</td>
                <td style={{ textAlign: 'center' }}>
                  <label
                    className="cfg-toggle"
                    title={c.is_active ? 'Bấm để ẩn trên website' : 'Bấm để hiện trên website'}
                  >
                    <input
                      type="checkbox"
                      checked={c.is_active}
                      onChange={() => toggleActive(c)}
                    />
                    <span className="cfg-toggle-track"><span className="cfg-toggle-thumb" /></span>
                  </label>
                </td>
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

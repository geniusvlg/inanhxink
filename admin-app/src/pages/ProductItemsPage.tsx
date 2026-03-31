import { useState, useEffect, useRef } from 'react';
import { productsApi, productCategoriesApi, uploadApi } from '../services/api';
import { type Product, type ProductCategory } from '../types';
import '../components/Layout.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

interface Props {
  type: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac';
}

const PAGE_TITLE: Record<string, string> = {
  thiep:        '🎴 Thiệp',
  khung_anh:    '🖼️ Khung Ảnh',
  so_scrapbook: '📒 Sổ Scrapbook',
  khac:         '📦 Các Sản Phẩm Khác',
};

// Represents either an already-saved URL or a pending local file
interface ImageEntry {
  url: string;        // server URL (saved) or object URL (local preview)
  file?: File;        // present only for pending local files
}

const emptyForm = (): Partial<Product> & { category_ids: number[] } => ({
  name: '', description: '', price: undefined, images: [], is_active: true, is_best_seller: false, watermark_enabled: false, category_ids: [],
});

export default function ProductItemsPage({ type }: Props) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Product | null>(null);
  const [form, setForm]             = useState<Partial<Product> & { category_ids: number[] }>(emptyForm());
  const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);
  const [saving, setSaving]         = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      productsApi.list(type),
      productCategoriesApi.list(type),
    ])
      .then(([pr, cr]) => {
        setProducts(pr.data.products ?? []);
        setCategories(cr.data.categories ?? []);
      })
      .catch(() => { setProducts([]); setCategories([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [type]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setImageEntries([]);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p, category_ids: p.categories.map(c => c.id) });
    setImageEntries(p.images.map(url => ({ url })));
    setShowModal(true);
  };

  const closeModal = () => {
    // Revoke any object URLs to free memory
    imageEntries.forEach(e => { if (e.file) URL.revokeObjectURL(e.url); });
    setShowModal(false);
    setEditing(null);
    setImageEntries([]);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const newEntries: ImageEntry[] = files.map(file => ({
      url: URL.createObjectURL(file),
      file,
    }));
    setImageEntries(prev => [...prev, ...newEntries]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (url: string) => {
    setImageEntries(prev => {
      const entry = prev.find(e => e.url === url);
      if (entry?.file) URL.revokeObjectURL(entry.url);
      return prev.filter(e => e.url !== url);
    });
  };

  const toggleCategory = (id: number) => {
    setForm(f => {
      const ids = f.category_ids ?? [];
      return {
        ...f,
        category_ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const pendingFiles = imageEntries.filter(e => e.file).map(e => e.file!);
      const savedUrls    = imageEntries.filter(e => !e.file).map(e => e.url);

      if (editing) {
        // Upload new files (if any) to the product's own folder
        let uploadedUrls: string[] = [];
        if (pendingFiles.length) {
          const res = await uploadApi.images(pendingFiles, `${type}/product-${editing.id}`, form.watermark_enabled ?? false);
          uploadedUrls = res.data.urls;
        }
        await productsApi.update(editing.id, {
          ...form,
          type,
          images: [...savedUrls, ...uploadedUrls],
        });
      } else {
        // Create product first (no images yet), then upload, then update
        const created = await productsApi.create({ ...form, type, images: [] });
        const productId = created.data.product.id;

        let images: string[] = [];
        if (pendingFiles.length) {
          const res = await uploadApi.images(pendingFiles, `${type}/product-${productId}`, form.watermark_enabled ?? false);
          images = res.data.urls;
        }
        if (images.length) {
          await productsApi.update(productId, { images });
        }
      }

      closeModal();
      load();
    } catch {
      alert('Lỗi khi lưu sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Product) => {
    await productsApi.update(p.id, { is_active: !p.is_active });
    load();
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Xoá sản phẩm "${p.name}"? Hành động này không thể hoàn tác.`)) return;
    await productsApi.delete(p.id);
    load();
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">{PAGE_TITLE[type]}</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm mới</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Ảnh</th>
              <th>Tên</th>
              <th>Giá</th>
              <th>Danh mục</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Chưa có sản phẩm nào</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  {p.images?.[0]
                    ? <img src={resolveUrl(p.images[0])} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                    : <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📷</div>
                  }
                </td>
                <td>
                  <strong>{p.name}</strong>
                  {p.description && (
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: 200, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {p.description}
                    </div>
                  )}
                </td>
                <td>{Number(p.price).toLocaleString('vi-VN')}đ</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {p.categories?.map(c => (
                      <span key={c.id} className="badge badge-blue">{c.name}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                    {p.is_active ? 'Đang bán' : 'Ẩn'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-edit"      onClick={() => openEdit(p)}>Sửa</button>
                  <button className="btn-secondary" style={{ fontSize: '0.825rem', padding: '0.35rem 0.75rem' }} onClick={() => handleToggle(p)}>
                    {p.is_active ? 'Ẩn' : 'Hiện'}
                  </button>
                  <button className="btn-danger"    onClick={() => handleDelete(p)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
            <form onSubmit={handleSave}>

              {/* Name */}
              <div className="form-group">
                <label className="form-label">Tên * <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(tối đa 50 ký tự)</span></label>
                <input className="form-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={50} required />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-textarea" rows={6} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Price */}
              <div className="form-group">
                <label className="form-label">Giá (đ) *</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={form.price != null ? form.price.toLocaleString('en') : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '');
                    if (raw === '') { setForm(f => ({ ...f, price: undefined })); return; }
                    const num = Number(raw);
                    if (!isNaN(num)) setForm(f => ({ ...f, price: num }));
                  }}
                  required
                />
              </div>

              {/* Categories */}
              <div className="form-group">
                <label className="form-label">Danh mục</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '0.375rem', background: '#fff' }}>
                  {categories.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                      <input
                        type="checkbox"
                        checked={(form.category_ids ?? []).includes(c.id)}
                        onChange={() => toggleCategory(c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                  {categories.length === 0 && <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Chưa có danh mục</span>}
                </div>
              </div>

              {/* Image Upload */}
              <div className="form-group">
                <label className="form-label">Ảnh sản phẩm</label>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
                  💡 Ảnh đầu tiên sẽ được dùng làm thumbnail hiển thị ngoài danh sách.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  {imageEntries.map(entry => (
                    <div key={entry.url} style={{ position: 'relative' }}>
                      <img
                        src={entry.file ? entry.url : resolveUrl(entry.url)}
                        alt=""
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(entry.url)}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}
                      >×</button>
                    </div>
                  ))}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-input"
                  style={{ padding: '0.35rem' }}
                  onChange={handleImagePick}
                />
              </div>

              {/* Active */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="pi_active" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="pi_active" className="form-label" style={{ margin: 0 }}>Đang bán</label>
              </div>

              {/* Best seller */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="pi_best_seller" checked={form.is_best_seller ?? false} onChange={e => setForm(f => ({ ...f, is_best_seller: e.target.checked }))} />
                <label htmlFor="pi_best_seller" className="form-label" style={{ margin: 0 }}>⭐ Best Seller</label>
              </div>

              {/* Watermark */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="pi_watermark" checked={form.watermark_enabled ?? false} onChange={e => setForm(f => ({ ...f, watermark_enabled: e.target.checked }))} />
                <label htmlFor="pi_watermark" className="form-label" style={{ margin: 0 }}>
                  🔏 Thêm watermark vào ảnh
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400 }}>
                    (áp dụng khi upload ảnh mới)
                  </span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

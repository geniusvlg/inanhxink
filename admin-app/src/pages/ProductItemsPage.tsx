import { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { productsApi, productCategoriesApi, uploadApi } from '../services/api';
import { type Product, type ProductCategory } from '../types';
import '../components/Layout.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

interface Props {
  type: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang';
}

const PAGE_TITLE: Record<string, string> = {
  thiep:          '🎴 Thiệp',
  khung_anh:      '🖼️ Khung Ảnh',
  so_scrapbook:   '📒 Sổ Scrapbook',
  khac:           '📦 Các Sản Phẩm Khác',
  'set-qua-tang': '🎁 Set Quà Tặng',
};


type DiscountStatus = 'active' | 'scheduled' | 'expired';

function parseDiscountTime(value?: string | null): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function getDiscountStatus(product: Pick<Product, 'discount_from' | 'discount_to'>): DiscountStatus {
  const now = Date.now();
  const fromTs = parseDiscountTime(product.discount_from);
  const toTs = parseDiscountTime(product.discount_to);

  if (fromTs !== null && fromTs > now) return 'scheduled';
  if (toTs !== null && toTs < now) return 'expired';
  return 'active';
}

function getDiscountStatusUi(status: DiscountStatus): { label: string; style: React.CSSProperties } {
  if (status === 'active') {
    return {
      label: 'Đang áp dụng',
      style: {
        color: '#166534',
        background: '#dcfce7',
        border: '1px solid #86efac',
      },
    };
  }
  if (status === 'scheduled') {
    return {
      label: 'Sắp bắt đầu',
      style: {
        color: '#1d4ed8',
        background: '#dbeafe',
        border: '1px solid #93c5fd',
      },
    };
  }
  return {
    label: 'Đã kết thúc',
    style: {
      color: '#6b7280',
      background: '#f3f4f6',
      border: '1px solid #d1d5db',
    },
  };
}

// Represents either an already-saved URL or a pending local file
interface ImageEntry {
  url: string;        // server URL (saved) or object URL (local preview)
  file?: File;        // present only for pending local files
}

const emptyForm = (): Partial<Product> & { category_ids: number[] } => ({
  name: '', description: '', price: undefined, images: [], is_active: true, is_best_seller: false, watermark_enabled: false, tiktok_url: null, instagram_url: null, category_ids: [],
  discount_price: null, discount_from: null, discount_to: null,
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
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [limit, setLimit]           = useState(20);
  const fileRef                     = useRef<HTMLInputElement>(null);

  const load = (p = page, l = limit) => {
    setLoading(true);
    Promise.all([
      productsApi.list(type, p, l),
      productCategoriesApi.list(type),
    ])
      .then(([pr, cr]) => {
        setProducts(pr.data.products ?? []);
        setTotal(pr.data.total ?? 0);
        setCategories(cr.data.categories ?? []);
      })
      .catch(() => { setProducts([]); setCategories([]); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); load(1, limit); }, [type]);

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
        // Create product as inactive first (avoids showing imageless product publicly)
        const created = await productsApi.create({ ...form, type, images: [], is_active: false });
        const productId = created.data.product.id;

        try {
          let images: string[] = [];
          if (pendingFiles.length) {
            const res = await uploadApi.images(pendingFiles, `${type}/product-${productId}`, form.watermark_enabled ?? false);
            images = res.data.urls;
          }
          // Activate + attach images in one update
          await productsApi.update(productId, { images, is_active: form.is_active ?? true });
        } catch (err) {
          // Rollback: remove the product so no ghost entries are left
          await productsApi.delete(productId);
          throw err;
        }
      }

      closeModal();
      load();
    } catch (err) {
      Sentry.captureException(err);
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
              <th>Giá / Giảm giá</th>
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
                <td>
                  <div>{Number(p.price).toLocaleString('vi-VN')}đ</div>
                  {p.discount_price != null && (() => {
                    const statusUi = getDiscountStatusUi(getDiscountStatus(p));
                    return (
                      <>
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>
                          ▼ {Number(p.discount_price).toLocaleString('vi-VN')}đ
                        </div>
                        <div style={{ marginTop: '0.2rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.08rem 0.42rem',
                              borderRadius: 999,
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              lineHeight: 1.4,
                              ...statusUi.style,
                            }}
                          >
                            {statusUi.label}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                  {(p.discount_from || p.discount_to) && (
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {p.discount_from ? new Date(p.discount_from).toLocaleDateString('vi-VN') : '∞'}
                      {' → '}
                      {p.discount_to   ? new Date(p.discount_to).toLocaleDateString('vi-VN')   : '∞'}
                    </div>
                  )}
                </td>
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

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" disabled={page === 1} onClick={() => { setPage(page - 1); load(page - 1); }}>← Trước</button>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Trang {page} / {Math.ceil(total / limit)} ({total} sản phẩm)
          </span>
          <button className="btn-secondary" disabled={page >= Math.ceil(total / limit)} onClick={() => { setPage(page + 1); load(page + 1); }}>Sau →</button>
          <select
            value={limit}
            onChange={e => { const l = Number(e.target.value); setLimit(l); setPage(1); load(1, l); }}
            style={{ padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
          >
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / trang</option>)}
          </select>
        </div>
      )}

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

              {/* Discount price */}
              <div className="form-group">
                <label className="form-label">Giá khuyến mãi (đ) <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>— để trống nếu không giảm giá</span></label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Để trống nếu không có"
                  value={form.discount_price != null ? form.discount_price.toLocaleString('en') : ''}
                  onChange={e => {
                    const raw = e.target.value.replace(/,/g, '');
                    if (raw === '') { setForm(f => ({ ...f, discount_price: null })); return; }
                    const num = Number(raw);
                    if (!isNaN(num)) setForm(f => ({ ...f, discount_price: num }));
                  }}
                />
              </div>

              {/* Discount date range */}
              {form.discount_price != null && (
                <div className="form-group">
                  <label className="form-label">Thời gian áp dụng <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>— để trống = không giới hạn</span></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Từ</label>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={form.discount_from ? form.discount_from.slice(0, 16) : ''}
                        onChange={e => setForm(f => ({ ...f, discount_from: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Đến</label>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={form.discount_to ? form.discount_to.slice(0, 16) : ''}
                        onChange={e => setForm(f => ({ ...f, discount_to: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                      />
                    </div>
                  </div>
                </div>
              )}

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

              {/* TikTok URL */}
              <div className="form-group">
                <label className="form-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '0.3rem', verticalAlign: 'middle' }}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                  TikTok URL
                </label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://tiktok.com/@username/video/..."
                  value={form.tiktok_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value || null }))}
                />
              </div>

              {/* Instagram URL */}
              <div className="form-group">
                <label className="form-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.3rem', verticalAlign: 'middle' }}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  Instagram URL
                </label>
                <input
                  className="form-input"
                  type="url"
                  placeholder="https://instagram.com/p/..."
                  value={form.instagram_url ?? ''}
                  onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value || null }))}
                />
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

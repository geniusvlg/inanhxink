import { useState, useEffect, useRef } from 'react';
import { productsApi, productCategoriesApi, uploadApi, productVariantsApi } from '../services/api';
import { type Product, type ProductCategory, type ProductVariant } from '../types';
import LoadingGif from '../components/LoadingGif';
import { resolveAssetUrl } from '../utils/assetUrl';
import { captureException } from '../utils/sentry';
import '../components/Layout.css';

interface Props {
  type: 'thiep' | 'khung_anh' | 'so_scrapbook' | 'khac' | 'set-qua-tang' | 'in_anh';
}

const PAGE_TITLE: Record<string, string> = {
  thiep:          '🎴 Thiệp',
  khung_anh:      '🖼️ Khung Ảnh',
  so_scrapbook:   '📒 Sổ Scrapbook',
  khac:           '📦 Các Sản Phẩm Khác',
  'set-qua-tang': '🎁 Set Quà Tặng',
  in_anh:         '🖨️ In Ảnh',
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

/** Comma thousands for Phân loại price inputs (aligned with product `price` / `discount_price` fields). */
function formatMoneyInputWithCommas(rawInput: string): string {
  const raw = rawInput.replace(/,/g, '');
  if (raw === '') return '';
  const num = Number(raw);
  if (isNaN(num)) return '';
  return num.toLocaleString('en');
}

/** Comma thousands for whole numbers only (e.g. Đã bán). */
function formatIntegerInputWithCommas(rawInput: string): string {
  const raw = rawInput.replace(/,/g, '').replace(/\D/g, '');
  if (raw === '') return '';
  const num = Number(raw);
  if (!Number.isFinite(num)) return '';
  return num.toLocaleString('en');
}

/** `datetime-local` value from ISO string (discount window from API). */
function isoToDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_NEW_VARIANT = {
  name: '',
  price: '',
  discount_price: '',
  discount_from: '',
  discount_to: '',
  image: null as string | null,
};

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


const emptyForm = (): Partial<Product> & { category_ids: number[] } => ({
  name: '', description: '', price: undefined, images: [], thumbnail_url: null, is_active: true, is_best_seller: false, watermark_enabled: true, tiktok_url: null, instagram_url: null, category_ids: [],
  discount_price: null, discount_from: null, discount_to: null,
  max_upload_images: 15,
  sold_count: 0,
  is_featured_on_home: false,
});

function productThumbnailUrl(product: Pick<Product, 'thumbnail_url' | 'images'>): string | null {
  return product.thumbnail_url || product.images?.[0] || null;
}

export default function ProductItemsPage({ type }: Props) {
  const [products, setProducts]     = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Product | null>(null);
  const [form, setForm]             = useState<Partial<Product> & { category_ids: number[] }>(emptyForm());
  const [maxUploadImagesInput, setMaxUploadImagesInput] = useState('15');
  const [soldCountInput, setSoldCountInput]             = useState('0');
  const [imageEntries, setImageEntries] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [reservedProductId, setReservedProductId] = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [nameCheckState, setNameCheckState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [page, setPage]             = useState(1);
  const [total, setTotal]           = useState(0);
  const [limit, setLimit]           = useState(20);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const thumbnailRef                = useRef<HTMLInputElement>(null);

  // Variant state
  const [variants, setVariants]             = useState<ProductVariant[]>([]);
  const [newVariant, setNewVariant]         = useState<{
    name: string; price: string; discount_price: string;
    discount_from: string; discount_to: string; image: string | null;
  }>({ ...EMPTY_NEW_VARIANT });
  /** Index into `variants` when the bottom form edits an existing row (not add). */
  const [variantEditIdx, setVariantEditIdx] = useState<number | null>(null);
  const [uploadingVariantImg, setUploadingVariantImg] = useState(false);
  const [savingVariants, setSavingVariants] = useState(false);
  const variantImgRef                       = useRef<HTMLInputElement>(null);

  // When variants exist, auto-derive product price from the lowest effective variant price.
  useEffect(() => {
    if (variants.length === 0) return;
    const minPrice = Math.min(
      ...variants.map(v => (v.discount_price != null && v.discount_price < v.price ? v.discount_price : v.price)),
    );
    setForm(f => ({ ...f, price: minPrice, discount_price: null }));
  }, [variants]);

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
    setMaxUploadImagesInput('15');
    setSoldCountInput('0');
    setImageEntries([]);
    setReservedProductId(null);
    setNameCheckState('idle');
    setVariants([]);
    setVariantEditIdx(null);
    setNewVariant({ ...EMPTY_NEW_VARIANT });
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ ...p, category_ids: p.categories.map(c => c.id) });
    setMaxUploadImagesInput(String(p.max_upload_images ?? 15));
    setSoldCountInput(formatIntegerInputWithCommas(String(p.sold_count ?? 0)));
    setImageEntries(p.images);
    setReservedProductId(null);
    setNameCheckState('available');
    setVariants([]);
    setVariantEditIdx(null);
    setNewVariant({ ...EMPTY_NEW_VARIANT });
    setShowModal(true);
    // Load existing variants
    productVariantsApi.list(p.id)
      .then(res => setVariants((res.data.variants ?? []) as ProductVariant[]))
      .catch(() => {});
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setImageEntries([]);
    setReservedProductId(null);
    setSoldCountInput('0');
    setNameCheckState('idle');
    setVariants([]);
    setVariantEditIdx(null);
    setNewVariant({ ...EMPTY_NEW_VARIANT });
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (fileRef.current) fileRef.current.value = '';

    const productId = editing?.id ?? reservedProductId;
    if (!productId) return;

    setUploadingImages(true);
    try {
      const res = await uploadApi.images(files, `${type}/product-${productId}`, form.watermark_enabled ?? false);
      setImageEntries(prev => [...prev, ...res.data.urls]);
    } catch (err: unknown) {
      captureException(err);
      const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
      if (axiosErr.response?.status === 413) {
        alert('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 50MB.');
      } else {
        alert('Lỗi khi tải ảnh lên');
      }
    } finally {
      setUploadingImages(false);
    }
  };

  const handleThumbnailPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (thumbnailRef.current) thumbnailRef.current.value = '';

    const productId = editing?.id ?? reservedProductId;
    if (!productId) return;

    setUploadingThumbnail(true);
    try {
      const res = await uploadApi.images(files.slice(0, 1), `${type}/product-${productId}/thumbnail`, form.watermark_enabled ?? false);
      setForm(f => ({ ...f, thumbnail_url: res.data.urls[0] ?? null }));
    } catch (err: unknown) {
      captureException(err);
      alert('Lỗi khi tải thumbnail lên');
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const clearThumbnail = () => {
    setForm(f => ({ ...f, thumbnail_url: null }));
  };

  const removeImage = (url: string) => {
    setImageEntries(prev => prev.filter(u => u !== url));
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

  const handleCheckName = async () => {
    const name = form.name?.trim() ?? '';
    if (!name) return;
    setNameCheckState('checking');
    try {
      const checkRes = await productsApi.checkName(name, type);
      if (!checkRes.data.available) {
        setNameCheckState('taken');
        return;
      }
      const reserveRes = await productsApi.reserve(name, type);
      setReservedProductId(reserveRes.data.productId);
      setNameCheckState('available');
    } catch {
      setNameCheckState('idle');
    }
  };

  const handleVariantImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (variantImgRef.current) variantImgRef.current.value = '';
    const productId = editing?.id ?? reservedProductId;
    if (!productId) return;
    setUploadingVariantImg(true);
    try {
      const res = await uploadApi.images(files.slice(0, 1), `${type}/product-${productId}/variants`, false);
      setNewVariant(v => ({ ...v, image: res.data.urls[0] ?? null }));
    } catch (err) {
      captureException(err);
      alert('Lỗi khi tải ảnh phân loại lên');
    } finally {
      setUploadingVariantImg(false);
    }
  };

  const startEditVariant = (idx: number) => {
    const v = variants[idx];
    if (!v) return;
    setVariantEditIdx(idx);
    setNewVariant({
      name: v.name,
      price: formatMoneyInputWithCommas(String(v.price)),
      discount_price:
        v.discount_price != null && v.discount_price !== undefined
          ? formatMoneyInputWithCommas(String(v.discount_price))
          : '',
      discount_from: isoToDatetimeLocal(v.discount_from),
      discount_to: isoToDatetimeLocal(v.discount_to),
      image: v.image,
    });
  };

  const cancelVariantEdit = () => {
    setVariantEditIdx(null);
    setNewVariant({ ...EMPTY_NEW_VARIANT });
  };

  const handleCommitVariantForm = () => {
    const name = newVariant.name.trim();
    const price = Number(newVariant.price.replace(/,/g, ''));
    if (!name || isNaN(price) || price < 0) {
      alert('Vui lòng nhập tên và giá hợp lệ cho phân loại');
      return;
    }
    const discountPrice = newVariant.discount_price ? Number(newVariant.discount_price.replace(/,/g, '')) : null;
    const discountFrom = newVariant.discount_from ? new Date(newVariant.discount_from).toISOString() : null;
    const discountTo = newVariant.discount_to ? new Date(newVariant.discount_to).toISOString() : null;

    if (variantEditIdx !== null) {
      setVariants(prev =>
        prev.map((it, i) =>
          i !== variantEditIdx
            ? it
            : {
                ...it,
                name,
                price,
                discount_price: discountPrice,
                discount_from: discountFrom,
                discount_to: discountTo,
                image: newVariant.image,
              },
        ),
      );
    } else {
      const nextOrder = variants.length;
      setVariants(prev => [
        ...prev,
        {
          name,
          price,
          discount_price: discountPrice,
          discount_from: discountFrom,
          discount_to: discountTo,
          image: newVariant.image,
          sort_order: nextOrder,
        },
      ]);
    }
    cancelVariantEdit();
  };

  const handleRemoveVariant = (idx: number) => {
    if (variantEditIdx === idx) cancelVariantEdit();
    else if (variantEditIdx !== null && variantEditIdx > idx) setVariantEditIdx(variantEditIdx - 1);
    setVariants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveVariants = async (productId: number) => {
    setSavingVariants(true);
    try {
      const payload = variants.map((v, i) => ({ ...v, sort_order: i }));
      const res = await productVariantsApi.upsert(productId, payload);
      setVariants((res.data.variants ?? []) as ProductVariant[]);
    } catch (err) {
      captureException(err);
      alert('Lỗi khi lưu phân loại');
    } finally {
      setSavingVariants(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && nameCheckState !== 'available') return;
    setSaving(true);
    try {
      const productId = editing?.id ?? reservedProductId!;
      const soldRaw = soldCountInput.replace(/,/g, '').replace(/\D/g, '');
      const soldCount = Math.max(0, soldRaw === '' ? 0 : Number(soldRaw));
      await productsApi.update(productId, {
        ...form,
        type,
        images: imageEntries,
        max_upload_images: Number(maxUploadImagesInput) > 0 ? Number(maxUploadImagesInput) : 15,
        sold_count: soldCount,
        is_active: form.is_active ?? true,
        is_featured_on_home: form.is_featured_on_home ?? false,
      });
      // Save variants (only meaningful in edit mode, but safe to call always)
      await handleSaveVariants(productId);
      closeModal();
      load();
    } catch (err) {
      captureException(err);
      alert('Lỗi khi lưu sản phẩm');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Product) => {
    try {
      await productsApi.update(p.id, { is_active: !p.is_active });
      load();
    } catch (err) {
      captureException(err);
      alert('Lỗi khi cập nhật trạng thái sản phẩm');
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Xoá sản phẩm "${p.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await productsApi.delete(p.id);
      load();
    } catch (err) {
      captureException(err);
      alert('Lỗi khi xoá sản phẩm');
    }
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
              <th>Đã bán</th>
              <th>Danh mục</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Chưa có sản phẩm nào</td></tr>
            )}
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  {productThumbnailUrl(p)
                    ? <img src={resolveAssetUrl(productThumbnailUrl(p)!)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }} />
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
                <td style={{ whiteSpace: 'nowrap' }}>{Number(p.sold_count ?? 0).toLocaleString('en')}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                    {p.categories?.map(c => (
                      <span key={c.id} className="badge badge-blue">{c.name}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
                    <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                      {p.is_active ? 'Đang bán' : 'Ẩn'}
                    </span>
                    {p.is_featured_on_home && (
                      <span
                        className="badge"
                        title="Đang hiển thị trên trang chủ"
                        style={{
                          background: '#fdf2f8',
                          color: '#be185d',
                          border: '1px solid #fbcfe8',
                          fontWeight: 600,
                        }}
                      >
                        🏠 Trang chủ
                      </span>
                    )}
                  </div>
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
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    className="form-input"
                    value={form.name ?? ''}
                    onChange={e => {
                      setForm(f => ({ ...f, name: e.target.value }));
                      if (!editing) setNameCheckState('idle');
                    }}
                    maxLength={50}
                    required
                    disabled={!!editing}
                    style={{ flex: 1 }}
                  />
                  {!editing && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCheckName}
                      disabled={!form.name?.trim() || nameCheckState === 'checking'}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {nameCheckState === 'checking' ? 'Đang kiểm tra...' : 'Kiểm tra'}
                    </button>
                  )}
                </div>
                {!editing && nameCheckState === 'available' && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#16a34a' }}>✓ Tên hợp lệ, có thể sử dụng</p>
                )}
                {!editing && nameCheckState === 'taken' && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#dc2626' }}>✗ Tên đã tồn tại, vui lòng chọn tên khác</p>
                )}
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Mô tả</label>
                <textarea className="form-textarea" rows={6} value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              {/* Price */}
              <div className="form-group">
                <label className="form-label">Giá (đ) *</label>
                {variants.length > 0 ? (
                  <>
                    <input
                      className="form-input"
                      type="text"
                      value={form.price != null ? form.price.toLocaleString('en') : ''}
                      readOnly
                      disabled
                      style={{ background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
                    />
                    <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.35rem 0 0' }}>
                      💡 Giá được tự động lấy từ phân loại có giá thấp nhất.
                    </p>
                  </>
                ) : (
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
                )}
              </div>

              {/* Discount price — hidden when variants control pricing */}
              {variants.length === 0 && (
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
              )}

              {/* Discount date range — only shown when no variants and a discount price is set */}
              {variants.length === 0 && form.discount_price != null && (
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

              {/* Đã bán — manual total; checkout increases automatically */}
              <div className="form-group">
                <label className="form-label">Đã bán</label>
                <input
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={soldCountInput}
                  onChange={e => setSoldCountInput(formatIntegerInputWithCommas(e.target.value))}
                  onBlur={() => {
                    const raw = soldCountInput.replace(/,/g, '').replace(/\D/g, '');
                    const n = raw === '' ? 0 : Number(raw);
                    setSoldCountInput(formatIntegerInputWithCommas(String(n)) || '0');
                  }}
                />
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.35rem 0 0' }}>
                  Tự động tăng khi đơn thanh toán thành công; bạn có thể chỉnh hoặc cộng thêm bằng cách nhập số mới.
                </p>
              </div>

              {/* Customer upload limit */}
              <div className="form-group">
                <label className="form-label">Số ảnh khách được upload <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}>— mặc định 15</span></label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={100}
                  value={maxUploadImagesInput}
                  onChange={e => setMaxUploadImagesInput(e.target.value)}
                  onBlur={() => {
                    if (!maxUploadImagesInput.trim() || Number(maxUploadImagesInput) < 1) {
                      setMaxUploadImagesInput('15');
                    }
                  }}
                />
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.35rem 0 0' }}>
                  Áp dụng cho từng sản phẩm ở bước checkout "Ảnh & ghi chú".
                </p>
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

              {/* Thumbnail Upload */}
              <div className="form-group">
                <label className="form-label">Ảnh thumbnail</label>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
                  Nếu để trống, hệ thống sẽ dùng ảnh sản phẩm đầu tiên.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {form.thumbnail_url ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={resolveAssetUrl(form.thumbnail_url)}
                        alt=""
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                      />
                      <button
                        type="button"
                        onClick={clearThumbnail}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}
                      >×</button>
                    </div>
                  ) : (
                    <div style={{ width: 96, height: 96, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', padding: '0.5rem' }}>
                      Dùng ảnh đầu tiên
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => thumbnailRef.current?.click()}
                      disabled={uploadingThumbnail || (!editing && !reservedProductId)}
                    >
                      {uploadingThumbnail ? 'Đang tải...' : 'Tải thumbnail'}
                    </button>
                    {form.thumbnail_url && (
                      <button type="button" className="btn-secondary" onClick={clearThumbnail}>
                        Dùng ảnh đầu tiên
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={thumbnailRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleThumbnailPick}
                  disabled={!editing && !reservedProductId}
                />
              </div>

              {/* Image Upload */}
              <div className="form-group">
                <label className="form-label">Ảnh sản phẩm</label>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.5rem' }}>
                  💡 Ảnh đầu tiên sẽ được dùng làm thumbnail nếu bạn không tải thumbnail riêng.
                </p>
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    marginBottom: '0.5rem',
                    minHeight: imageEntries.length === 0 && uploadingImages ? 180 : undefined,
                    padding: uploadingImages ? '0.5rem' : 0,
                    border: uploadingImages ? '1px dashed #e2e8f0' : 'none',
                    borderRadius: uploadingImages ? 6 : 0,
                    background: uploadingImages ? '#f8fafc' : 'transparent',
                    transition: 'background 150ms ease',
                  }}
                >
                  {imageEntries.map(url => (
                    <div key={url} style={{ position: 'relative' }}>
                      <img
                        src={resolveAssetUrl(url)}
                        alt=""
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}
                      >×</button>
                    </div>
                  ))}
                  {uploadingImages && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: 'rgba(248, 250, 252, 0.85)',
                        backdropFilter: 'blur(2px)',
                        borderRadius: 6,
                        zIndex: 2,
                        pointerEvents: 'none',
                      }}
                    >
                      <LoadingGif size={140} label="Đang tải ảnh lên..." />
                      <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                        Đang tải ảnh lên...
                      </span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="form-input"
                  style={{ padding: '0.35rem' }}
                  onChange={handleImagePick}
                  disabled={!editing && !reservedProductId}
                />
              </div>

              {/* Phân loại (Variants) */}
              <div className="form-group">
                <label className="form-label">Phân loại</label>
                {!editing ? (
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.25rem 0 0' }}>
                    💡 Lưu sản phẩm trước, sau đó mở lại để thêm phân loại.
                  </p>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#f8fafc' }}>
                    {/* Existing variants list */}
                    {variants.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {variants.map((v, idx) => (
                          <div
                            key={v.id ?? `new-${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              background: '#fff',
                              border: variantEditIdx === idx ? '2px solid #6366f1' : '1px solid #e2e8f0',
                              borderRadius: 6,
                              padding: '0.4rem 0.6rem',
                            }}
                          >
                            {v.image ? (
                              <img src={resolveAssetUrl(v.image)} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                            ) : (
                              <div style={{ width: 36, height: 36, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🏷️</div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                              {v.discount_price != null ? (
                                <div style={{ fontSize: '0.8rem' }}>
                                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{Number(v.discount_price).toLocaleString('vi-VN')}đ</span>
                                  <span style={{ color: '#94a3b8', textDecoration: 'line-through', marginLeft: '0.3rem' }}>{Number(v.price).toLocaleString('vi-VN')}đ</span>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{Number(v.price).toLocaleString('vi-VN')}đ</div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditVariant(idx)}
                              style={{ background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}
                            >Sửa</button>
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(idx)}
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}
                            >Xoá</button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add new variant form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem', background: '#fff', border: variantEditIdx !== null ? '1px solid #c7d2fe' : '1px dashed #cbd5e1', borderRadius: 6 }}>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                        {variantEditIdx !== null ? '✎ Sửa phân loại (bấm Cập nhật để áp dụng)' : '+ Thêm phân loại mới'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                        <input
                          className="form-input"
                          placeholder="Tên phân loại (vd: Mẫu 1)"
                          value={newVariant.name}
                          onChange={e => setNewVariant(v => ({ ...v, name: e.target.value }))}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <input
                          className="form-input"
                          placeholder="Giá gốc (đ)"
                          inputMode="numeric"
                          value={newVariant.price}
                          onChange={e => setNewVariant(v => ({ ...v, price: formatMoneyInputWithCommas(e.target.value) }))}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <input
                          className="form-input"
                          placeholder="Giá khuyến mãi (để trống nếu không)"
                          inputMode="numeric"
                          value={newVariant.discount_price}
                          onChange={e => setNewVariant(v => ({ ...v, discount_price: formatMoneyInputWithCommas(e.target.value) }))}
                          style={{ fontSize: '0.85rem' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input
                            className="form-input"
                            type="datetime-local"
                            title="Giảm giá từ"
                            value={newVariant.discount_from}
                            onChange={e => setNewVariant(v => ({ ...v, discount_from: e.target.value }))}
                            style={{ fontSize: '0.78rem' }}
                            disabled={!newVariant.discount_price}
                          />
                          <input
                            className="form-input"
                            type="datetime-local"
                            title="Giảm giá đến"
                            value={newVariant.discount_to}
                            onChange={e => setNewVariant(v => ({ ...v, discount_to: e.target.value }))}
                            style={{ fontSize: '0.78rem' }}
                            disabled={!newVariant.discount_price}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {newVariant.image ? (
                          <div style={{ position: 'relative' }}>
                            <img src={resolveAssetUrl(newVariant.image)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0' }} />
                            <button
                              type="button"
                              onClick={() => setNewVariant(v => ({ ...v, image: null }))}
                              style={{ position: 'absolute', top: -6, right: -6, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 10, lineHeight: '16px', padding: 0 }}
                            >×</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => variantImgRef.current?.click()}
                            disabled={uploadingVariantImg}
                            style={{ background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: 4, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}
                          >
                            {uploadingVariantImg ? 'Đang tải...' : '📷 Ảnh'}
                          </button>
                        )}
                        <input ref={variantImgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleVariantImagePick} />
                        {variantEditIdx !== null && (
                          <button
                            type="button"
                            onClick={cancelVariantEdit}
                            className="btn-secondary"
                            style={{ fontSize: '0.825rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
                          >
                            Huỷ sửa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleCommitVariantForm}
                          disabled={!newVariant.name.trim() || !newVariant.price}
                          className="btn-primary"
                          style={{ fontSize: '0.825rem', padding: '0.3rem 0.75rem', whiteSpace: 'nowrap' }}
                        >
                          {variantEditIdx !== null ? 'Cập nhật' : 'Thêm'}
                        </button>
                      </div>
                    </div>
                    {savingVariants && <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.25rem 0 0' }}>Đang lưu phân loại...</p>}
                  </div>
                )}
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

              {/* Featured on homepage */}
              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="pi_featured_home"
                  checked={form.is_featured_on_home ?? false}
                  onChange={e => setForm(f => ({ ...f, is_featured_on_home: e.target.checked }))}
                  style={{ marginTop: '0.2rem' }}
                />
                <label htmlFor="pi_featured_home" className="form-label" style={{ margin: 0 }}>
                  🏠 Hiện trên trang chủ
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400, marginTop: '0.15rem' }}>
                    Sản phẩm sẽ xuất hiện trong khu sản phẩm nổi bật ở trang chủ. Có thể sắp xếp thứ tự ở trang
                    <strong style={{ color: '#64748b' }}> SP trang chủ</strong>.
                  </div>
                </label>
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
                <button type="submit" className="btn-primary" disabled={saving || (!editing && nameCheckState !== 'available')}>
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

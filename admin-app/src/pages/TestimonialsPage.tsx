import { useEffect, useRef, useState } from 'react';
import { testimonialsApi, uploadApi, type TestimonialBulkItem } from '../services/api';
import { type Testimonial, type TestimonialPlatform } from '../types';
import '../components/Layout.css';
import './TestimonialsPage.css';

const PLATFORMS: { value: TestimonialPlatform; label: string }[] = [
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'zalo',      label: 'Zalo' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other',     label: 'Khác' },
];

const platformLabel = (p: string) =>
  PLATFORMS.find(x => x.value === p)?.label ?? p;

type EditForm = {
  image_url: string;
  platform: TestimonialPlatform;
  reviewer_name: string;
  caption: string;
  is_featured: boolean;
  is_featured_on_home: boolean;
};

const emptyForm = (): EditForm => ({
  image_url: '',
  platform: 'other',
  reviewer_name: '',
  caption: '',
  is_featured: false,
  is_featured_on_home: false,
});

type PendingItem = {
  tempId:              string;
  image_url:           string;
  platform:            TestimonialPlatform;
  reviewer_name:       string;
  caption:             string;
  is_featured:         boolean;
  is_featured_on_home: boolean;
};

const makePending = (image_url: string): PendingItem => ({
  tempId:              crypto.randomUUID(),
  image_url,
  platform:            'other',
  reviewer_name:       '',
  caption:             '',
  is_featured:         false,
  is_featured_on_home: false,
});

export default function TestimonialsPage() {
  const [items, setItems]       = useState<Testimonial[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing]   = useState<Testimonial | null>(null);
  const [form, setForm]         = useState<EditForm>(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [replacing, setReplacing] = useState(false);

  const [pending, setPending]               = useState<PendingItem[]>([]);
  const [pendingSaving, setPendingSaving]   = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    testimonialsApi.list()
      .then(r => setItems(r.data.testimonials ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Bulk upload (step 1: push to S3, then open Review modal) ────────────
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const upload = await uploadApi.testimonials(files);
      const urls = upload.data.urls ?? [];
      if (urls.length > 0) {
        setPending(prev => [...prev, ...urls.map(makePending)]);
      }
    } catch {
      alert('Lỗi khi tải lên ảnh');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Pending review (step 2: configure each item, then bulk-save) ────────
  const updatePending = (tempId: string, patch: Partial<PendingItem>) => {
    setPending(prev => prev.map(p => p.tempId === tempId ? { ...p, ...patch } : p));
  };
  const removePending = (tempId: string) => {
    const target = pending.find(p => p.tempId === tempId);
    setPending(prev => prev.filter(p => p.tempId !== tempId));
    if (target) uploadApi.deleteMany([target.image_url]);
  };
  const cancelPending = () => {
    if (pending.length > 0 && !confirm(`Huỷ ${pending.length} ảnh chưa lưu?`)) return;
    const urls = pending.map(p => p.image_url);
    setPending([]);
    if (urls.length > 0) uploadApi.deleteMany(urls);
  };
  const savePending = async () => {
    if (pending.length === 0) return;
    setPendingSaving(true);
    try {
      const payload: TestimonialBulkItem[] = pending.map(p => ({
        image_url:           p.image_url,
        platform:            p.platform,
        reviewer_name:       p.reviewer_name.trim() || null,
        caption:             p.caption.trim()       || null,
        is_featured:         p.is_featured,
        is_featured_on_home: p.is_featured_on_home,
      }));
      await testimonialsApi.bulk(payload);
      setPending([]);
      load();
    } catch {
      alert('Lỗi khi lưu danh sách');
    } finally {
      setPendingSaving(false);
    }
  };

  // ── Edit ────────────────────────────────────────────────────────────────
  const openEdit = (t: Testimonial) => {
    setEditing(t);
    setForm({
      image_url:           t.image_url,
      platform:            t.platform,
      reviewer_name:       t.reviewer_name ?? '',
      caption:             t.caption ?? '',
      is_featured:         t.is_featured,
      is_featured_on_home: t.is_featured_on_home,
    });
  };
  /** Close the edit modal. When `discardUnsavedImage` is true (default — i.e.
   *  user dismissed without saving), an orphaned replacement upload is purged
   *  from S3. Pass `false` after a successful save: the new image_url is now
   *  persisted in the DB, so deleting it would break the row. */
  const closeEdit = (discardUnsavedImage = true) => {
    if (
      discardUnsavedImage
      && editing
      && form.image_url
      && form.image_url !== editing.image_url
    ) {
      uploadApi.deleteMany([form.image_url]);
    }
    setEditing(null);
    setForm(emptyForm());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await testimonialsApi.update(editing.id, {
        image_url:           form.image_url,
        platform:            form.platform,
        reviewer_name:       form.reviewer_name.trim() || null,
        caption:             form.caption.trim() || null,
        is_featured:         form.is_featured,
        is_featured_on_home: form.is_featured_on_home,
      });
      // The image was replaced — purge the previous (now-unreferenced) file.
      if (form.image_url !== editing.image_url && editing.image_url) {
        uploadApi.deleteMany([editing.image_url]);
      }
      closeEdit(false);
      load();
    } catch {
      alert('Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      const upload = await uploadApi.testimonials([file]);
      const url = upload.data.urls?.[0];
      if (url) {
        // If the form already shows an UNSAVED replacement (i.e. user uploaded
        // twice without clicking Lưu), purge the previous orphan from S3.
        const previous = form.image_url;
        const original = editing?.image_url;
        if (previous && previous !== url && previous !== original) {
          uploadApi.deleteMany([previous]);
        }
        setForm(f => ({ ...f, image_url: url }));
      }
    } catch {
      alert('Lỗi khi tải ảnh mới');
    } finally {
      setReplacing(false);
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  // ── Quick toggles ───────────────────────────────────────────────────────
  const toggleFeatured = async (t: Testimonial) => {
    setItems(prev => prev.map(x => x.id === t.id ? { ...x, is_featured: !t.is_featured } : x));
    try {
      await testimonialsApi.update(t.id, { is_featured: !t.is_featured });
      load();
    } catch {
      alert('Lỗi khi cập nhật');
      load();
    }
  };

  const toggleHome = async (t: Testimonial) => {
    setItems(prev => prev.map(x => x.id === t.id ? { ...x, is_featured_on_home: !t.is_featured_on_home } : x));
    try {
      await testimonialsApi.update(t.id, { is_featured_on_home: !t.is_featured_on_home });
      load();
    } catch {
      alert('Lỗi khi cập nhật');
      load();
    }
  };

  // Swap sort_order with neighbour
  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[idx];
    const b = items[target];
    const next = items.slice();
    next[idx]    = { ...a, sort_order: b.sort_order };
    next[target] = { ...b, sort_order: a.sort_order };
    setItems(next);
    try {
      await testimonialsApi.reorder([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ]);
      load();
    } catch {
      alert('Lỗi khi sắp xếp');
      load();
    }
  };

  const handleDelete = async (t: Testimonial) => {
    if (!confirm('Xoá đánh giá này?')) return;
    try {
      await testimonialsApi.delete(t.id);
      load();
    } catch {
      alert('Lỗi khi xoá');
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">💬 Feedback</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleBulkUpload}
            style={{ display: 'none' }}
          />
          <button
            className="btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Đang tải...' : '+ Tải lên ảnh đánh giá'}
          </button>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '6rem' }}>Ảnh</th>
              <th>Nền tảng</th>
              <th>Người đánh giá</th>
              <th>Caption</th>
              <th style={{ textAlign: 'center' }}>Nổi bật</th>
              <th style={{ textAlign: 'center' }}>Trang chủ</th>
              <th style={{ width: '7rem' }}>Sắp xếp</th>
              <th style={{ width: '12rem' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  Chưa có đánh giá nào — bấm "Tải lên ảnh đánh giá" để bắt đầu
                </td>
              </tr>
            )}
            {items.map((t, idx) => (
              <tr key={t.id}>
                <td>
                  <a href={t.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={t.image_url} alt="" className="testimonial-thumb" />
                  </a>
                </td>
                <td><span className="badge badge-platform">{platformLabel(t.platform)}</span></td>
                <td>{t.reviewer_name || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                <td className="testimonial-caption-cell">
                  {t.caption || <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="testimonial-star-btn"
                    onClick={() => toggleFeatured(t)}
                    title={t.is_featured ? 'Bỏ nổi bật' : 'Đánh dấu nổi bật'}
                  >
                    {t.is_featured ? '⭐' : '☆'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="testimonial-star-btn"
                    onClick={() => toggleHome(t)}
                    title={t.is_featured_on_home ? 'Bỏ khỏi trang chủ' : 'Hiển thị trên trang chủ'}
                    style={{ opacity: t.is_featured_on_home ? 1 : 0.35 }}
                  >
                    🏠
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      className="btn-edit"
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      title="Lên"
                    >↑</button>
                    <button
                      className="btn-edit"
                      onClick={() => move(idx, +1)}
                      disabled={idx === items.length - 1}
                      title="Xuống"
                    >↓</button>
                  </div>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-edit"   onClick={() => openEdit(t)}>Sửa</button>
                  <button className="btn-danger" onClick={() => handleDelete(t)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => closeEdit()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Sửa đánh giá</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Ảnh</label>
                <div className="testimonial-image-edit">
                  {form.image_url && (
                    <img src={form.image_url} alt="" className="testimonial-image-preview" />
                  )}
                  <input
                    ref={replaceInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReplaceImage}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => replaceInputRef.current?.click()}
                    disabled={replacing}
                  >
                    {replacing ? 'Đang tải...' : 'Thay ảnh'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nền tảng *</label>
                <select
                  className="form-select"
                  value={form.platform}
                  onChange={e => setForm(f => ({ ...f, platform: e.target.value as TestimonialPlatform }))}
                  required
                >
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tên người đánh giá</label>
                <input
                  className="form-input"
                  value={form.reviewer_name}
                  onChange={e => setForm(f => ({ ...f, reviewer_name: e.target.value }))}
                  placeholder="VD: Minh Anh"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Caption / Nội dung trích</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="VD: Sản phẩm rất đẹp, đóng gói cẩn thận..."
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="t_featured"
                  checked={form.is_featured}
                  onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                />
                <label htmlFor="t_featured" className="form-label" style={{ margin: 0 }}>
                  ⭐ Nổi bật (hiển thị đầu tiên trang đánh giá)
                </label>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="t_home"
                  checked={form.is_featured_on_home}
                  onChange={e => setForm(f => ({ ...f, is_featured_on_home: e.target.checked }))}
                />
                <label htmlFor="t_home" className="form-label" style={{ margin: 0 }}>
                  🏠 Hiển thị trên trang chủ
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => closeEdit()}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="modal-overlay" onClick={pendingSaving ? undefined : cancelPending}>
          <div
            className="modal modal-pending"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="modal-title">
              Cấu hình đánh giá mới ({pending.length})
            </h2>
            <p className="pending-hint">
              Điền thông tin cho từng ảnh rồi bấm "Lưu tất cả". Nếu huỷ, ảnh sẽ bị xoá (không tốn dung lượng).
            </p>

            <div className="pending-list">
              {pending.map(p => (
                <div key={p.tempId} className="pending-row">
                  <img src={p.image_url} alt="" className="pending-thumb" />
                  <div className="pending-fields">
                    <div className="pending-field-row">
                      <label className="form-label">Nền tảng *</label>
                      <select
                        className="form-select"
                        value={p.platform}
                        onChange={e => updatePending(p.tempId, {
                          platform: e.target.value as TestimonialPlatform,
                        })}
                      >
                        {PLATFORMS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="pending-field-row">
                      <label className="form-label">Người đánh giá</label>
                      <input
                        className="form-input"
                        value={p.reviewer_name}
                        onChange={e => updatePending(p.tempId, { reviewer_name: e.target.value })}
                        placeholder="VD: Minh Anh"
                      />
                    </div>
                    <div className="pending-field-row">
                      <label className="form-label">Caption</label>
                      <textarea
                        className="form-input"
                        rows={2}
                        value={p.caption}
                        onChange={e => updatePending(p.tempId, { caption: e.target.value })}
                        placeholder="VD: Sản phẩm rất đẹp..."
                      />
                    </div>
                    <div className="pending-field-row pending-field-inline">
                      <label className="pending-checkbox">
                        <input
                          type="checkbox"
                          checked={p.is_featured}
                          onChange={e => updatePending(p.tempId, { is_featured: e.target.checked })}
                        />
                        ⭐ Nổi bật
                      </label>
                      <label className="pending-checkbox">
                        <input
                          type="checkbox"
                          checked={p.is_featured_on_home}
                          onChange={e => updatePending(p.tempId, { is_featured_on_home: e.target.checked })}
                        />
                        🏠 Trang chủ
                      </label>
                      <button
                        type="button"
                        className="btn-danger pending-remove"
                        onClick={() => removePending(p.tempId)}
                        disabled={pendingSaving}
                      >Bỏ ảnh này</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelPending}
                disabled={pendingSaving}
              >Huỷ tất cả</button>
              <button
                type="button"
                className="btn-primary"
                onClick={savePending}
                disabled={pendingSaving}
              >
                {pendingSaving ? 'Đang lưu...' : `Lưu tất cả (${pending.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

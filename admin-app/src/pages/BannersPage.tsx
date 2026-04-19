import { useEffect, useRef, useState } from 'react';
import { bannersApi, uploadApi } from '../services/api';
import { type Banner } from '../types';
import '../components/Layout.css';
import './BannersPage.css';

type EditForm = {
  image_url: string;
  link_url:  string;
  alt_text:  string;
  is_active: boolean;
};

const emptyForm = (): EditForm => ({
  image_url: '',
  link_url:  '',
  alt_text:  '',
  is_active: true,
});

export default function BannersPage() {
  const [items, setItems]         = useState<Banner[]>([]);
  const [loading, setLoading]     = useState(true);
  const [creating, setCreating]   = useState(false);
  const [editing, setEditing]     = useState<Banner | null>(null);
  const [form, setForm]           = useState<EditForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    bannersApi.list()
      .then(r => setItems(r.data.banners ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // ── Modal helpers ───────────────────────────────────────────────────────
  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm());
  };
  const openEdit = (b: Banner) => {
    setCreating(false);
    setEditing(b);
    setForm({
      image_url: b.image_url,
      link_url:  b.link_url ?? '',
      alt_text:  b.alt_text ?? '',
      is_active: b.is_active,
    });
  };

  /** Close the modal. When `discardUnsavedImage` is true (user dismissed),
   *  any new upload that hasn't been persisted is purged from S3. */
  const closeModal = (discardUnsavedImage = true) => {
    const original = editing?.image_url ?? '';
    if (
      discardUnsavedImage
      && form.image_url
      && form.image_url !== original
    ) {
      uploadApi.deleteMany([form.image_url]);
    }
    setCreating(false);
    setEditing(null);
    setForm(emptyForm());
  };

  // ── Image upload (within the modal) ─────────────────────────────────────
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = await uploadApi.banners([file]);
      const url = upload.data.urls?.[0];
      if (url) {
        // Purge any previous unsaved upload (admin uploaded twice in a row)
        const previous = form.image_url;
        const original = editing?.image_url ?? '';
        if (previous && previous !== url && previous !== original) {
          uploadApi.deleteMany([previous]);
        }
        setForm(f => ({ ...f, image_url: url }));
      }
    } catch {
      alert('Lỗi khi tải ảnh');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.image_url) {
      alert('Vui lòng chọn ảnh banner');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        image_url: form.image_url,
        link_url:  form.link_url.trim() || null,
        alt_text:  form.alt_text.trim() || null,
        is_active: form.is_active,
      };
      if (editing) {
        await bannersApi.update(editing.id, payload);
        // The PUT route handles old-image S3 cleanup server-side.
      } else {
        await bannersApi.create(payload);
      }
      closeModal(false);
      load();
    } catch {
      alert('Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  // ── Quick toggles ───────────────────────────────────────────────────────
  const toggleActive = async (b: Banner) => {
    setItems(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !b.is_active } : x));
    try {
      await bannersApi.update(b.id, { is_active: !b.is_active });
      load();
    } catch {
      alert('Lỗi khi cập nhật');
      load();
    }
  };

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
      await bannersApi.reorder([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ]);
      load();
    } catch {
      alert('Lỗi khi sắp xếp');
      load();
    }
  };

  const handleDelete = async (b: Banner) => {
    if (!confirm('Xoá banner này?')) return;
    try {
      await bannersApi.delete(b.id);
      load();
    } catch {
      alert('Lỗi khi xoá');
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  const modalOpen = creating || editing !== null;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🖼️ Banner trang chủ</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm banner</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '12rem' }}>Ảnh</th>
              <th>Link khi click</th>
              <th>Mô tả (alt)</th>
              <th style={{ textAlign: 'center' }}>Hiển thị</th>
              <th style={{ width: '7rem' }}>Sắp xếp</th>
              <th style={{ width: '12rem' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                  Chưa có banner nào — bấm "Thêm banner" để bắt đầu
                </td>
              </tr>
            )}
            {items.map((b, idx) => (
              <tr key={b.id}>
                <td>
                  <a href={b.image_url} target="_blank" rel="noopener noreferrer">
                    <img src={b.image_url} alt={b.alt_text ?? ''} className="banner-thumb" />
                  </a>
                </td>
                <td className="banner-link-cell">
                  {b.link_url
                    ? <a href={b.link_url} target="_blank" rel="noopener noreferrer">{b.link_url}</a>
                    : <span style={{ color: '#94a3b8' }}>—</span>}
                </td>
                <td>{b.alt_text || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    className="banner-toggle-btn"
                    onClick={() => toggleActive(b)}
                    title={b.is_active ? 'Đang hiển thị — bấm để ẩn' : 'Đang ẩn — bấm để hiện'}
                  >
                    {b.is_active ? '✅' : '🚫'}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button className="btn-edit" onClick={() => move(idx, -1)} disabled={idx === 0}            title="Lên">↑</button>
                    <button className="btn-edit" onClick={() => move(idx, +1)} disabled={idx === items.length - 1} title="Xuống">↓</button>
                  </div>
                </td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-edit"   onClick={() => openEdit(b)}>Sửa</button>
                  <button className="btn-danger" onClick={() => handleDelete(b)}>Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => closeModal()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Sửa banner' : 'Thêm banner mới'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Ảnh banner *</label>
                <div className="banner-image-edit">
                  {form.image_url
                    ? <img src={form.image_url} alt="" className="banner-image-preview" />
                    : <div className="banner-image-placeholder">Chưa có ảnh</div>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Đang tải...' : (form.image_url ? 'Thay ảnh' : 'Tải ảnh lên')}
                  </button>
                </div>
                <p className="form-hint">Khuyến nghị: ảnh tỷ lệ 16:6 (vd 1600×600), &lt; 1 MB.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Link khi click (tuỳ chọn)</label>
                <input
                  className="form-input"
                  value={form.link_url}
                  onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))}
                  placeholder="VD: /thiep hoặc https://..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mô tả (alt) (tuỳ chọn)</label>
                <input
                  className="form-input"
                  value={form.alt_text}
                  onChange={e => setForm(f => ({ ...f, alt_text: e.target.value }))}
                  placeholder="VD: Khuyến mãi tháng 4"
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="b_active"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                />
                <label htmlFor="b_active" className="form-label" style={{ margin: 0 }}>
                  Hiển thị trên trang chủ
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => closeModal()}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving || !form.image_url}>
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

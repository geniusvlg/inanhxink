import { useEffect, useRef, useState } from 'react';
import { heroShotsApi, uploadApi } from '../services/api';
import { type HeroShot } from '../types';
import '../components/Layout.css';
import './BannersPage.css';   // reuses .form-hint
import './HeroShotsPage.css';

type SlotIdx = 0 | 1 | 2;

type EditForm = {
  image_url: string;
  caption:   string;
};

const emptyForm = (): EditForm => ({ image_url: '', caption: '' });

const SLOT_LABELS: Record<SlotIdx, string> = {
  0: 'Trái trên',
  1: 'Phải trên',
  2: 'Giữa dưới',
};

export default function HeroShotsPage() {
  const [shots, setShots]         = useState<HeroShot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState<HeroShot | null>(null);
  const [form, setForm]           = useState<EditForm>(emptyForm());
  const [saving, setSaving]       = useState(false);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    heroShotsApi.list()
      .then(r => setShots(r.data.hero_shots ?? []))
      .catch(() => setShots([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openEdit = (s: HeroShot) => {
    setEditing(s);
    setForm({
      image_url: s.image_url ?? '',
      caption:   s.caption ?? '',
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
    setEditing(null);
    setForm(emptyForm());
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const upload = await uploadApi.heroShots([file]);
      const url = upload.data.urls?.[0];
      if (url) {
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

  const handleClearImage = () => {
    if (form.image_url && form.image_url !== editing?.image_url) {
      uploadApi.deleteMany([form.image_url]);
    }
    setForm(f => ({ ...f, image_url: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await heroShotsApi.update(editing.slot, {
        image_url: form.image_url || null,
        caption:   form.caption.trim() || null,
      });
      closeModal(false);
      load();
    } catch {
      alert('Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📸 Ảnh polaroid trang chủ</h1>
      </div>

      <p style={{ color: '#64748b', margin: '0 0 1rem' }}>
        Trang chủ có 3 polaroid xếp chồng ở khu hero. Mỗi ô có thể đặt một ảnh và một dòng chú thích viết tay.
        Ảnh đẹp nhất khi tỷ lệ vuông (1:1).
      </p>

      <div className="hero-shots-grid">
        {shots.map(s => (
          <div key={s.slot} className="hero-shot-card">
            <div className="hero-shot-card-header">
              <span>Polaroid #{s.slot + 1}</span>
              <span className="hero-shot-slot-label">{SLOT_LABELS[s.slot as SlotIdx]}</span>
            </div>

            {s.image_url
              ? <img src={s.image_url} alt={s.caption ?? ''} className="hero-shot-thumb" />
              : <div className="hero-shot-placeholder">Chưa có ảnh</div>}

            <div
              className={`hero-shot-caption${!s.caption ? ' hero-shot-caption-empty' : ''}`}
            >
              {s.caption || '— chưa có chú thích —'}
            </div>

            <button className="btn-edit" onClick={() => openEdit(s)}>Sửa ô này</button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal-overlay" onClick={() => closeModal()}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">
              Sửa Polaroid #{editing.slot + 1} ({SLOT_LABELS[editing.slot as SlotIdx]})
            </h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Ảnh polaroid</label>
                <div className="hero-shot-image-edit">
                  {form.image_url
                    ? <img src={form.image_url} alt="" className="hero-shot-image-edit-preview" />
                    : <div className="hero-shot-image-edit-placeholder">Chưa có ảnh</div>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    style={{ display: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? 'Đang tải...' : (form.image_url ? 'Thay ảnh' : 'Tải ảnh lên')}
                    </button>
                    {form.image_url && (
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={handleClearImage}
                        disabled={uploading}
                      >
                        Bỏ ảnh
                      </button>
                    )}
                  </div>
                </div>
                <p className="form-hint">Khuyến nghị ảnh tỷ lệ 1:1 (vuông), &lt; 1 MB.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Chú thích viết tay (tuỳ chọn)</label>
                <input
                  className="form-input"
                  value={form.caption}
                  onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
                  placeholder="VD: Thiệp"
                  maxLength={40}
                />
                <p className="form-hint">Hiển thị bên dưới ảnh bằng font viết tay.</p>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => closeModal()}>Huỷ</button>
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

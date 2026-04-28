import { useState, useEffect, useRef } from 'react';
import { metadataApi, uploadApi } from '../services/api';
import { resolveAssetUrl } from '../utils/assetUrl';
import '../components/Layout.css';

export default function InAnhPage() {
  // Price image
  const [priceImageUrl,       setPriceImageUrl]       = useState('');
  const [uploadingPriceImage, setUploadingPriceImage] = useState(false);
  const priceFileRef     = useRef<HTMLInputElement>(null);
  const originalPriceRef = useRef('');

  // Gallery
  const [gallery,          setGallery]          = useState<string[]>([]);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryFileRef     = useRef<HTMLInputElement>(null);
  const originalGalleryRef = useRef<string[]>([]);

  // Save
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    metadataApi.get().then(r => {
      const cfg = r.data.config ?? {};
      const price = cfg.in_anh_price_image_url ?? '';
      setPriceImageUrl(price);
      originalPriceRef.current = price;

      try {
        const g: string[] = JSON.parse(cfg.in_anh_gallery ?? '[]');
        setGallery(Array.isArray(g) ? g : []);
        originalGalleryRef.current = Array.isArray(g) ? [...g] : [];
      } catch {
        setGallery([]);
        originalGalleryRef.current = [];
      }
    }).catch(() => {});
  }, []);

  // ── Price image ────────────────────────────────────────────────────────
  const handlePriceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (priceFileRef.current) priceFileRef.current.value = '';
    setUploadingPriceImage(true);
    try {
      const res = await uploadApi.inAnhPriceImage([file]);
      const url = res.data.urls?.[0];
      if (url) {
        if (priceImageUrl && priceImageUrl !== originalPriceRef.current) uploadApi.deleteMany([priceImageUrl]);
        setPriceImageUrl(url);
      }
    } catch { alert('Lỗi khi tải ảnh'); }
    finally { setUploadingPriceImage(false); }
  };

  // ── Gallery ───────────────────────────────────────────────────────────
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (galleryFileRef.current) galleryFileRef.current.value = '';
    setUploadingGallery(true);
    try {
      const res = await uploadApi.inAnhGallery(files);
      setGallery(prev => [...prev, ...(res.data.urls ?? [])]);
    } catch { alert('Lỗi khi tải ảnh'); }
    finally { setUploadingGallery(false); }
  };

  const removeGalleryImage = (url: string) => {
    if (!originalGalleryRef.current.includes(url)) uploadApi.deleteMany([url]);
    setGallery(prev => prev.filter(u => u !== url));
  };

  const moveGallery = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= gallery.length) return;
    const next = gallery.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    setGallery(next);
  };

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await metadataApi.update({
        in_anh_price_image_url: priceImageUrl,
        in_anh_gallery:         JSON.stringify(gallery),
      });
      if (originalPriceRef.current && originalPriceRef.current !== priceImageUrl) {
        uploadApi.deleteMany([originalPriceRef.current]);
      }
      const removed = originalGalleryRef.current.filter(u => !gallery.includes(u));
      if (removed.length > 0) uploadApi.deleteMany(removed);

      originalPriceRef.current   = priceImageUrl;
      originalGalleryRef.current = gallery.slice();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert('Lỗi khi lưu'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🖨️ In Ảnh</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
          {saved && <span style={{ color: '#16a34a', fontSize: '0.875rem' }}>✓ Đã lưu!</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 800 }}>

        {/* ── Price table image ── */}
        <div className="admin-table-wrap" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🗒️ Ảnh bảng giá</div>
          <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Hiển thị trên đầu trang /in-anh.
          </p>
          {priceImageUrl && (
            <img
              src={resolveAssetUrl(priceImageUrl)}
              alt="Bảng giá"
              style={{ maxHeight: 260, maxWidth: '100%', borderRadius: 10, border: '2px solid #fce7f3', display: 'block', marginBottom: '0.75rem' }}
            />
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input ref={priceFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePriceUpload} />
            <button className="btn-secondary" onClick={() => priceFileRef.current?.click()} disabled={uploadingPriceImage}>
              {uploadingPriceImage ? 'Đang tải...' : priceImageUrl ? 'Thay ảnh' : '+ Tải ảnh lên'}
            </button>
            {priceImageUrl && <button className="btn-danger" onClick={() => setPriceImageUrl('')}>Xoá</button>}
          </div>
        </div>

        {/* ── Gallery ── */}
        <div className="admin-table-wrap" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>🖼️ Ảnh mẫu (gallery)</div>
          <p style={{ margin: '0 0 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Ảnh hiển thị dưới bảng giá theo dạng lưới. Có thể upload nhiều ảnh cùng lúc.
          </p>

          {gallery.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {gallery.map((url, idx) => (
                <div key={url} style={{ position: 'relative', width: 100 }}>
                  <img
                    src={resolveAssetUrl(url)}
                    alt=""
                    style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, display: 'block', border: '1px solid #e5e7eb' }}
                  />
                  <div style={{ display: 'flex', gap: '2px', marginTop: '3px', justifyContent: 'center' }}>
                    <button className="btn-edit" style={{ padding: '1px 5px', fontSize: '0.7rem' }} onClick={() => moveGallery(idx, -1)} disabled={idx === 0}>←</button>
                    <button className="btn-edit" style={{ padding: '1px 5px', fontSize: '0.7rem' }} onClick={() => moveGallery(idx, +1)} disabled={idx === gallery.length - 1}>→</button>
                    <button className="btn-danger" style={{ padding: '1px 5px', fontSize: '0.7rem' }} onClick={() => removeGalleryImage(url)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input ref={galleryFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleGalleryUpload} />
            <button className="btn-secondary" onClick={() => galleryFileRef.current?.click()} disabled={uploadingGallery}>
              {uploadingGallery ? 'Đang tải...' : `+ Thêm ảnh${gallery.length > 0 ? ` (${gallery.length} ảnh)` : ''}`}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

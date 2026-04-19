import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';
import { productsApi } from '../services/api';
import { type Product } from '../types';
import '../components/Layout.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const resolveUrl = (url: string) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const TYPE_LABEL: Record<string, string> = {
  thiep:          'Thiệp',
  khung_anh:      'Khung Ảnh',
  so_scrapbook:   'Sổ Scrapbook',
  khac:           'Khác',
  'set-qua-tang': 'Set Quà Tặng',
  in_anh:         'In Ảnh',
};

/** Subset of Product returned by /featured-on-home — narrower than the full
 *  admin list so we don't need every column. */
type FeaturedRow = Pick<
  Product,
  'id' | 'name' | 'price' | 'images' | 'type' | 'is_active' | 'home_sort_order'
> & { is_draft?: boolean; categories?: { id: number; name: string }[] };

export default function FeaturedOnHomePage() {
  const [items, setItems]     = useState<FeaturedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [dirty, setDirty]     = useState(false);

  const load = () => {
    setLoading(true);
    productsApi.listFeaturedOnHome()
      .then(res => {
        setItems(res.data.products ?? []);
        setDirty(false);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  /** Move row at `idx` by `delta` positions (delta=-1 up, delta=+1 down). */
  const move = (idx: number, delta: number) => {
    const target = idx + delta;
    if (target < 0 || target >= items.length) return;
    setItems(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  };

  /** Remove this product from the homepage feature set (toggles flag to false).
   *  Saves immediately — no batched dirty state. */
  const unfeature = async (p: FeaturedRow) => {
    if (!confirm(`Bỏ "${p.name}" khỏi trang chủ?`)) return;
    try {
      await productsApi.update(p.id, { is_featured_on_home: false });
      load();
    } catch (err) {
      Sentry.captureException(err);
      alert('Lỗi khi cập nhật');
    }
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      // Re-number from 1; gaps don't matter but keeping it dense is nicer.
      const payload = items.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
      await productsApi.reorderFeaturedOnHome(payload);
      setDirty(false);
    } catch (err) {
      Sentry.captureException(err);
      alert('Lỗi khi lưu thứ tự');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🏠 Sản phẩm trang chủ</h1>
        {dirty && (
          <button className="btn-primary" onClick={saveOrder} disabled={saving}>
            {saving ? 'Đang lưu...' : '💾 Lưu thứ tự'}
          </button>
        )}
      </div>

      <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1rem' }}>
        Sản phẩm hiển thị trong khu nổi bật ở trang chủ. Dùng nút ↑ / ↓ để sắp xếp thứ tự
        (số nhỏ hiển thị trước). Để thêm sản phẩm mới, mở trang chi tiết sản phẩm (Thiệp,
        Khung Ảnh, …) và bật ô <strong>🏠 Hiện trên trang chủ</strong>.
      </p>

      {items.length === 0 ? (
        <div
          style={{
            padding: '3rem 1rem',
            textAlign: 'center',
            color: '#94a3b8',
            background: '#f8fafc',
            borderRadius: '0.5rem',
            border: '1px dashed #e2e8f0',
          }}
        >
          Chưa có sản phẩm nào được chọn để hiển thị trên trang chủ.
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Thứ tự</th>
                <th style={{ width: 64 }}>Ảnh</th>
                <th>Tên</th>
                <th>Loại</th>
                <th>Giá</th>
                <th>Trạng thái</th>
                <th style={{ width: 200 }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p, idx) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700, color: '#475569' }}>{idx + 1}</td>
                  <td>
                    {p.images?.[0] ? (
                      <img
                        src={resolveUrl(p.images[0])}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48, height: 48, background: '#f1f5f9', borderRadius: 4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        }}
                      >
                        📷
                      </div>
                    )}
                  </td>
                  <td><strong>{p.name}</strong></td>
                  <td><span className="badge badge-blue">{TYPE_LABEL[p.type] ?? p.type}</span></td>
                  <td>{Number(p.price).toLocaleString('vi-VN')}đ</td>
                  <td>
                    {p.is_active ? (
                      <span className="badge badge-green">Đang bán</span>
                    ) : (
                      <span className="badge badge-red">Ẩn (sẽ không hiện trên trang chủ)</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      title="Lên một bậc"
                    >↑</button>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => move(idx, 1)}
                      disabled={idx === items.length - 1}
                      title="Xuống một bậc"
                    >↓</button>
                    <button
                      className="btn-danger"
                      style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                      onClick={() => unfeature(p)}
                    >Bỏ khỏi trang chủ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

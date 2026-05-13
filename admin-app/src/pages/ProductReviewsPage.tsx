import { useState, useEffect, useMemo } from 'react';
import { productsApi } from '../services/api';
import type { Product } from '../types';
import ProductReviewAdminPanel from '../components/ProductReviewAdminPanel';
import '../components/Layout.css';

const TYPE_OPTIONS: { value: Product['type']; label: string }[] = [
  { value: 'thiep', label: 'Thiệp' },
  { value: 'khung_anh', label: 'Khung ảnh' },
  { value: 'so_scrapbook', label: 'Sổ & Scrapbook' },
  { value: 'khac', label: 'Các SP khác' },
  { value: 'set-qua-tang', label: 'Set quà tặng' },
  { value: 'in_anh', label: 'In ảnh' },
];

export default function ProductReviewsPage() {
  const [type, setType] = useState<Product['type']>('thiep');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [nameFilter, setNameFilter] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [type]);

  useEffect(() => {
    setLoading(true);
    productsApi
      .list(type, page, limit)
      .then((res) => {
        setProducts(res.data.products ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => {
        setProducts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [type, page, limit]);

  const filteredProducts = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, nameFilter]);

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.25rem', color: '#0f172a' }}>Đánh giá sản phẩm</h1>
      <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.25rem' }}>
        Chọn loại sản phẩm và một dòng trong bảng để xem / thêm / xoá đánh giá hiển thị trên trang chi tiết sản phẩm.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Loại sản phẩm
          </label>
          <select className="form-input" style={{ minWidth: 200 }} value={type} onChange={(e) => setType(e.target.value as Product['type'])}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="form-label" style={{ display: 'block', marginBottom: '0.25rem' }}>
            Lọc tên (trang hiện tại)
          </label>
          <input className="form-input" placeholder="Gõ để lọc…" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>Đang tải…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: '1.25rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>ID</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Tên</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>TB sao</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Số đánh giá</th>
                  <th style={{ padding: '0.5rem 0.75rem' }} />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', color: '#64748b' }}>
                      Không có sản phẩm nào khớp.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const active = selected?.id === p.id;
                    return (
                      <tr key={p.id} style={{ background: active ? '#eff6ff' : undefined, borderTop: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace' }}>{p.id}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.average_rating != null ? Number(p.average_rating).toFixed(1) : '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.review_count ?? 0}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          <button type="button" className={active ? 'btn-primary' : 'btn-secondary'} style={{ fontSize: '0.8rem' }} onClick={() => setSelected(p)}>
                            {active ? 'Đang chọn' : 'Quản lý đánh giá'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <button className="btn-secondary" disabled={page === 1} onClick={() => setPage((x) => x - 1)}>
                ← Trước
              </button>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
                Trang {page} / {Math.max(1, Math.ceil(total / limit))} ({total} SP)
              </span>
              <button className="btn-secondary" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((x) => x + 1)}>
                Sau →
              </button>
              <select
                className="form-input"
                style={{ width: 'auto', padding: '0.35rem 0.5rem' }}
                value={limit}
                onChange={(e) => {
                  const l = Number(e.target.value);
                  setLimit(l);
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}/trang
                  </option>
                ))}
              </select>
            </div>
          )}

          {selected ? (
            <section style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem 1.25rem', background: '#fff' }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem', color: '#0f172a' }}>
                Đánh giá: <span style={{ fontWeight: 600 }}>{selected.name}</span>
                <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}> (ID {selected.id})</span>
              </h2>
              <ProductReviewAdminPanel productId={selected.id} />
            </section>
          ) : (
            <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Chọn &quot;Quản lý đánh giá&quot; trên một sản phẩm để bắt đầu.</p>
          )}
        </>
      )}
    </div>
  );
}

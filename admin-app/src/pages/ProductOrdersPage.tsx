import { useCallback, useEffect, useState } from 'react';
import { productOrdersApi } from '../services/api';
import { type ProductOrder, type ProductOrderItem } from '../types';
import { resolveAssetUrl } from '../utils/assetUrl';
import '../components/Layout.css';

const PAYMENT_OPTIONS = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];

const PAYMENT_LABEL: Record<string, string> = {
  pending:   'Chờ thanh toán',
  paid:      'Đã thanh toán',
  failed:    'Thất bại',
  refunded:  'Hoàn tiền',
  cancelled: 'Đã huỷ',
};

const PAYMENT_STYLE: Record<string, React.CSSProperties> = {
  pending:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' },
  paid:      { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  failed:    { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  refunded:  { background: '#e0f2fe', color: '#075985', border: '1px solid #7dd3fc' },
  cancelled: { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' },
};

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{
      padding: '0.2rem 0.65rem',
      borderRadius: '999px',
      fontWeight: 600,
      fontSize: '0.78rem',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  return <Badge label={PAYMENT_LABEL[status] ?? status} style={PAYMENT_STYLE[status] ?? {}} />;
}

function fmt(n: number | null | undefined) {
  return `${Math.round(Number(n ?? 0)).toLocaleString('vi-VN')}đ`;
}

function itemLineLabel(it: ProductOrderItem): string {
  const variant = it.variant_name?.trim();
  const name = variant ? `${it.product_name} — ${variant}` : it.product_name;
  return `${name} x${it.quantity}`;
}

function itemSummary(items: ProductOrderItem[]) {
  if (!items.length) return '—';
  const names = items.slice(0, 2).map(itemLineLabel);
  return items.length > 2 ? `${names.join(', ')} +${items.length - 2}` : names.join(', ');
}

function firstCatalogImage(items: ProductOrderItem[] | undefined): string | null {
  if (!items?.length) return null;
  for (const it of items) {
    const u = it.catalog_image?.trim();
    if (u) return u;
  }
  return null;
}

export default function ProductOrdersPage() {
  const [orders, setOrders]                 = useState<ProductOrder[]>([]);
  const [total, setTotal]                   = useState(0);
  const [page, setPage]                     = useState(1);
  const [loading, setLoading]               = useState(true);
  const [filterPayment, setFilterPayment]   = useState('');
  const [detail, setDetail]                 = useState<ProductOrder | null>(null);
  const [editPayment, setEditPayment]       = useState('');
  const [saving, setSaving]                 = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);
  const LIMIT = 20;

  const load = useCallback((p: number) => {
    setLoading(true);
    const params: Record<string, string | number> = { page: p, limit: LIMIT };
    if (filterPayment) params.payment_status = filterPayment;
    productOrdersApi.list(params)
      .then(r => {
        setOrders(r.data.product_orders ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch(() => {
        setOrders([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [filterPayment]);

  useEffect(() => { load(1); setPage(1); }, [filterPayment, load]);
  useEffect(() => { load(page); }, [page, load]);

  const openDetail = (o: ProductOrder) => {
    setDetail(o);
    setEditPayment(o.payment_status);
  };

  const handleSaveStatus = async () => {
    if (!detail) { setDetail(null); return; }
    if (editPayment === detail.payment_status) { setDetail(null); return; }
    setShowConfirm(true);
  };

  const handleConfirmSave = async () => {
    if (!detail) return;
    setShowConfirm(false);
    setSaving(true);
    try {
      await productOrdersApi.updateStatus(detail.id, { payment_status: editPayment });
      load(page);
    } finally {
      setSaving(false);
      setDetail(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📦 Đơn sản phẩm</h1>
        <select className="form-select" style={{ width: 'auto' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
          <option value="">Tất cả thanh toán</option>
          {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
        </select>
      </div>

      {loading ? <div className="admin-loading">Đang tải...</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID / Mã đơn</th><th>Khách hàng</th><th>Sản phẩm</th>
                  <th>Tổng tiền</th><th>Thanh toán</th><th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td>
                      <div>#{o.id}</div>
                      <code>{o.invoice_number || `SHOP${o.id}`}</code>
                    </td>
                    <td>
                      <div>{o.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{o.customer_phone}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {firstCatalogImage(o.items) && (
                          <img
                            src={resolveAssetUrl(firstCatalogImage(o.items)!)}
                            alt=""
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0', flexShrink: 0 }}
                          />
                        )}
                        <span>{itemSummary(o.items ?? [])}</span>
                      </div>
                    </td>
                    <td>{fmt(o.total_amount)}</td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
            <span style={{ lineHeight: '2.1rem', color: '#64748b', fontSize: '0.875rem' }}>
              Trang {page} / {totalPages || 1} ({total} đơn)
            </span>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Tiếp →</button>
          </div>
        </>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Chi tiết đơn sản phẩm #{detail.id}</h2>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['Mã đơn',     detail.invoice_number || `SHOP${detail.id}`],
                  ['Khách hàng', detail.customer_name],
                  ['Email',      detail.customer_email || '—'],
                  ['SĐT',        detail.customer_phone],
                  ['Địa chỉ',    detail.customer_address],
                  ['Tạm tính',   fmt(detail.subtotal)],
                  ['Tổng tiền',  fmt(detail.total_amount)],
                  ['Ngày tạo',   new Date(detail.created_at).toLocaleString('vi-VN')],
                ] as [string, string][]).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', width: '30%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#1e293b' }}>{v}</td>
                  </tr>
                ))}

                <tr>
                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', verticalAlign: 'middle' }}>Thanh toán</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <PaymentBadge status={detail.payment_status} />
                      {editPayment !== detail.payment_status && (
                        <><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span><PaymentBadge status={editPayment} /></>
                      )}
                    </div>
                    <select className="form-select" style={{ width: '100%' }} value={editPayment} onChange={e => setEditPayment(e.target.value)}>
                      {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>

            <h3 style={{ margin: '1rem 0 0.5rem', color: '#1e293b', fontSize: '1rem' }}>Sản phẩm</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 320, overflow: 'auto' }}>
              {(detail.items ?? []).map((item, idx) => (
                <div key={`${item.product_id}-${item.variant_id ?? 'base'}-${idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    {item.catalog_image?.trim() ? (
                      <a
                        href={resolveAssetUrl(item.catalog_image)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ flexShrink: 0 }}
                        title="Ảnh trên web (SP / Phân loại)"
                      >
                        <img
                          src={resolveAssetUrl(item.catalog_image)}
                          alt=""
                          style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0', display: 'block' }}
                        />
                      </a>
                    ) : (
                      <div
                        style={{
                          width: 72, height: 72, flexShrink: 0, borderRadius: 8, border: '1px dashed #cbd5e1',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: '#94a3b8', background: '#f8fafc',
                        }}
                        title="Đơn cũ — chưa lưu ảnh SP"
                      >
                        📷
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                        <div>
                          <strong>{item.product_name}</strong>
                          {item.variant_name?.trim() && (
                            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                              Phân loại: <strong style={{ color: '#334155' }}>{item.variant_name}</strong>
                            </div>
                          )}
                        </div>
                        <span style={{ whiteSpace: 'nowrap' }}>{item.quantity} x {fmt(item.unit_price)}</span>
                      </div>
                      {item.note && (
                        <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.5rem' }}>
                          Ghi chú: {item.note}
                        </div>
                      )}
                      {item.image_urls && item.image_urls.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.35rem' }}>Ảnh khách upload (checkout)</div>
                          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                            {item.image_urls.map((url, imageIdx) => (
                              <a key={`${url}-${imageIdx}`} href={resolveAssetUrl(url)} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={resolveAssetUrl(url)}
                                  alt=""
                                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }}
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDetail(null)}>Đóng</button>
              <button className="btn-primary" onClick={handleSaveStatus} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            </div>

            {showConfirm && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 'inherit', zIndex: 10,
              }}>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: '1.75rem 1.5rem',
                  maxWidth: 340, width: '90%', textAlign: 'center',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem', color: '#111827' }}>
                    Xác nhận cập nhật?
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.25rem' }}>
                    Đổi trạng thái thanh toán thành<br />
                    <strong style={{ color: '#111827' }}>"{PAYMENT_LABEL[editPayment] ?? editPayment}"</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                    <button className="btn-secondary" onClick={() => setShowConfirm(false)}>Huỷ</button>
                    <button className="btn-primary" onClick={handleConfirmSave}>Xác nhận</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

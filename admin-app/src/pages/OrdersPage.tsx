import { useState, useEffect } from 'react';
import { ordersApi } from '../services/api';
import { type Order } from '../types';
import '../components/Layout.css';

const PAYMENT_OPTIONS = ['pending', 'paid', 'failed', 'refunded'];

export default function OrdersPage() {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [total, setTotal]                 = useState(0);
  const [page, setPage]                   = useState(1);
  const [loading, setLoading]             = useState(true);
  const [filterPayment, setFilterPayment] = useState('');
  const [detail, setDetail]               = useState<Order | null>(null);
  const LIMIT = 20;

  const load = (p = page) => {
    setLoading(true);
    const params: Record<string, string | number> = { page: p, limit: LIMIT };
    if (filterPayment) params.payment_status = filterPayment;
    ordersApi.list(params)
      .then(r => { setOrders(r.data.orders ?? []); setTotal(r.data.total ?? 0); })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); setPage(1); }, [filterPayment]);
  useEffect(() => { load(); }, [page]);

  const handleStatusChange = async (order: Order, field: 'payment_status', value: string) => {
    await ordersApi.updateStatus(order.id, { [field]: value });
    load();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📋 Đơn hàng</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">Tất cả thanh toán</option>
            {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="admin-loading">Đang tải...</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>QR Name</th><th>Khách hàng</th>
                  <th>Template</th><th>Tổng tiền</th>
                  <th>Thanh toán</th><th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(o)}>
                    <td>{o.id}</td>
                    <td><code>{o.qr_name}</code></td>
                    <td>
                      <div>{o.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{o.customer_phone}</div>
                    </td>
                    <td>{o.template_name}</td>
                    <td>{o.total_amount?.toLocaleString('vi-VN')}đ</td>
                    <td onClick={e => e.stopPropagation()}>
                      <select
                        className="form-select"
                        style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        value={o.payment_status}
                        onChange={e => handleStatusChange(o, 'payment_status', e.target.value)}
                      >
                        {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
            <span style={{ lineHeight: '2.1rem', color: '#64748b', fontSize: '0.875rem' }}>
              Trang {page} / {totalPages} ({total} đơn)
            </span>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Tiếp →</button>
          </div>
        </>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Chi tiết đơn #{detail.id}</h2>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['QR Name', detail.qr_name],
                  ['Khách hàng', detail.customer_name],
                  ['Email', detail.customer_email],
                  ['SĐT', detail.customer_phone],
                  ['Template', detail.template_name],
                  ['Voucher', detail.voucher_code || '—'],
                  ['Tổng tiền', `${detail.total_amount?.toLocaleString('vi-VN')}đ`],
                  ['Thanh toán', detail.payment_status],
                  ['Ngày tạo', new Date(detail.created_at).toLocaleString('vi-VN')],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', width: '35%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#1e293b' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDetail(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

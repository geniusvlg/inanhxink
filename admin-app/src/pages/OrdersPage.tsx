import { useState, useEffect } from 'react';
import { ordersApi } from '../services/api';
import { type Order } from '../types';
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

const KEYCHAIN_OPTIONS = ['pending', 'processing', 'shipped'];

const KEYCHAIN_LABEL: Record<string, string> = {
  pending:    'Chờ thanh toán',
  processing: 'Đang làm',
  shipped:    'Đã giao',
};

const KEYCHAIN_STYLE: Record<string, React.CSSProperties> = {
  pending:    { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' },
  processing: { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
  shipped:    { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
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

function KeychainBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>;
  return <Badge label={KEYCHAIN_LABEL[status] ?? status} style={KEYCHAIN_STYLE[status] ?? {}} />;
}

export default function OrdersPage() {
  const [orders, setOrders]                       = useState<Order[]>([]);
  const [total, setTotal]                         = useState(0);
  const [page, setPage]                           = useState(1);
  const [loading, setLoading]                     = useState(true);
  const [filterPayment, setFilterPayment]         = useState('');
  const [filterKeychain, setFilterKeychain]       = useState('');
  const [detail, setDetail]                       = useState<Order | null>(null);
  const [editPayment, setEditPayment]             = useState('');
  const [editKeychain, setEditKeychain]           = useState<string>('');
  const [saving, setSaving]                       = useState(false);
  const LIMIT = 20;

  const load = (p = page) => {
    setLoading(true);
    const params: Record<string, string | number> = { page: p, limit: LIMIT };
    if (filterPayment)  params.payment_status          = filterPayment;
    if (filterKeychain) params.keychain_delivery_status = filterKeychain;
    ordersApi.list(params)
      .then(r => { setOrders(r.data.orders ?? []); setTotal(r.data.total ?? 0); })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(1); setPage(1); }, [filterPayment, filterKeychain]);
  useEffect(() => { load(); }, [page]);

  const openDetail = (o: Order) => {
    setDetail(o);
    setEditPayment(o.payment_status);
    setEditKeychain(o.keychain_delivery_status ?? '');
  };

  const handleSaveStatus = async () => {
    if (!detail) { setDetail(null); return; }
    const data: { payment_status?: string; keychain_delivery_status?: string } = {};
    if (editPayment !== detail.payment_status)                               data.payment_status          = editPayment;
    if (editKeychain !== (detail.keychain_delivery_status ?? '')) data.keychain_delivery_status = editKeychain;
    if (Object.keys(data).length === 0) { setDetail(null); return; }
    setSaving(true);
    try {
      await ordersApi.updateStatus(detail.id, data);
      load();
    } finally {
      setSaving(false);
      setDetail(null);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">📋 Đơn hàng</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="form-select" style={{ width: 'auto' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">Tất cả thanh toán</option>
            {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={filterKeychain} onChange={e => setFilterKeychain(e.target.value)}>
            <option value="">Tất cả móc khoá</option>
            {KEYCHAIN_OPTIONS.map(s => <option key={s} value={s}>{KEYCHAIN_LABEL[s]}</option>)}
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
                  <th>Thanh toán</th><th>Móc khoá</th><th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td>{o.id}</td>
                    <td><code>{o.qr_name}</code></td>
                    <td>
                      <div>{o.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{o.customer_phone}</div>
                    </td>
                    <td>{o.template_name}</td>
                    <td>{o.total_amount?.toLocaleString('vi-VN')}đ</td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td><KeychainBadge status={o.keychain_delivery_status} /></td>
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
                {([
                  ['QR Name',    detail.qr_name],
                  ['Khách hàng', detail.customer_name],
                  ['Email',      detail.customer_email],
                  ['SĐT',        detail.customer_phone],
                  ['Template',   detail.template_name],
                  ['Voucher',    detail.voucher_code || '—'],
                  ['Móc khoá',   detail.keychain_purchased ? `Có (+${detail.keychain_price?.toLocaleString('vi-VN')}đ)` : 'Không'],
                  ['Tổng tiền',  `${detail.total_amount?.toLocaleString('vi-VN')}đ`],
                  ['Ngày tạo',   new Date(detail.created_at).toLocaleString('vi-VN')],
                ] as [string, string][]).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', width: '35%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#1e293b' }}>{v}</td>
                  </tr>
                ))}

                {/* Payment status */}
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

                {/* Keychain delivery status — only editable when keychain was purchased */}
                <tr>
                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', verticalAlign: 'middle' }}>Sản xuất móc</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <KeychainBadge status={detail.keychain_delivery_status} />
                      {editKeychain !== (detail.keychain_delivery_status ?? '') && editKeychain && (
                        <><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span><KeychainBadge status={editKeychain} /></>
                      )}
                    </div>
                    {detail.keychain_purchased ? (
                      <select className="form-select" style={{ width: '100%' }} value={editKeychain} onChange={e => setEditKeychain(e.target.value)}>
                        {KEYCHAIN_OPTIONS.map(s => (
                          <option key={s} value={s}>{KEYCHAIN_LABEL[s]}</option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Khách không mua móc khoá</div>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDetail(null)}>Đóng</button>
              <button className="btn-primary" onClick={handleSaveStatus} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Cập nhật'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

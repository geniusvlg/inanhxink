import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { trackOrder, fetchSpxTracking, TrackOrderResult, SpxTrackingInfo } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './TrackOrderPage.css';

const STAGE_INFO: Record<string, { label: string; icon: string; pct: number }> = {
  new:       { label: 'Chờ xử lý',         icon: '🕐', pct: 10 },
  preparing: { label: 'Đang chuẩn bị',      icon: '🛠️', pct: 40 },
  packing:   { label: 'Đóng gói',            icon: '📦', pct: 70 },
  shipped:   { label: 'Đã giao vận chuyển', icon: '🚚', pct: 100 },
  pending:   { label: 'Chờ xử lý',          icon: '🕐', pct: 10 },
  processing: { label: 'Chờ xử lý',         icon: '🕐', pct: 10 },
  '':        { label: 'Chờ xử lý',          icon: '🕐', pct: 10 },
};

const STEPS = [
  { key: 'new',       label: 'Chờ xử lý'   },
  { key: 'preparing', label: 'Chuẩn bị'    },
  { key: 'packing',   label: 'Đóng gói'    },
  { key: 'shipped',   label: 'Giao hàng'   },
];

const SPX_STEP_ICONS: Record<string, string> = {
  pickup: '📦',
  transit: '🚚',
  out_for_delivery: '🏃',
  delivered: '✅',
};

function formatMoney(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v) + '₫';
}

function formatDate(s: string) {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function stepIndex(status: string) {
  const map: Record<string, number> = {
    new: 0, pending: 0, processing: 0, '': 0, preparing: 1, packing: 2, shipped: 3,
  };
  return map[status] ?? 0;
}

function paymentLabel(status: string) {
  if (status === 'paid') return 'Đã thanh toán';
  if (status === 'pending') return 'Chưa thanh toán';
  return status;
}

function itemSubtotal(item: { quantity: number; unit_price: number }) {
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

function spxStatusClass(statusGroup: string) {
  if (statusGroup === 'Delivered') return 'to-spx-status--delivered';
  if (statusGroup === 'Out For Delivery' || statusGroup === 'Out for delivery') return 'to-spx-status--delivering';
  return 'to-spx-status--transit';
}

function isSpxCarrier(carrier: string) {
  return !carrier || /spx/i.test(carrier);
}

export default function TrackOrderPage() {
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackOrderResult | null>(null);
  const [error, setError] = useState('');
  const [spxTracking, setSpxTracking] = useState<SpxTrackingInfo | null>(null);
  const [spxLoading, setSpxLoading] = useState(false);

  useEffect(() => {
    const initialCode = searchParams.get('code');
    if (initialCode) {
      handleSearch(initialCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSpxTracking = async (trackingCode: string) => {
    setSpxLoading(true);
    setSpxTracking(null);
    try {
      const data = await fetchSpxTracking(trackingCode.trim());
      setSpxTracking(data);
    } catch {
      // Not a valid SPX code or network error — silently hide the section
    } finally {
      setSpxLoading(false);
    }
  };

  const handleSearch = async (searchCode?: string) => {
    const trimmed = (searchCode ?? code).trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    setResult(null);
    setSpxTracking(null);
    try {
      const data = await trackOrder(trimmed);
      setResult(data);
      if (data.order.tracking_code && isSpxCarrier(data.order.shipping_carrier ?? '')) {
        loadSpxTracking(data.order.tracking_code);
      }
    } catch {
      setError('Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  const order = result?.order;
  const stage = STAGE_INFO[order?.fulfillment_status ?? ''] ?? STAGE_INFO['new'];
  const curStep = stepIndex(order?.fulfillment_status ?? '');
  const showSpx = Boolean(order?.tracking_code) && isSpxCarrier(order?.shipping_carrier ?? '') && (spxLoading || spxTracking !== null);

  return (
    <div className="to-layout">
      <SiteHeader activePage="tra-cuu-don-hang" />
      <div className="to-page">
        <div className="to-container">
        <div className="to-hero">
          <div className="to-hero-icon">📦</div>
          <h1 className="to-title">Tra cứu đơn hàng</h1>
          <p className="to-subtitle">
            Nhập mã đơn hàng (invoice) bạn nhận sau khi đặt hàng — thường có dạng <strong>INXK…</strong>
          </p>
        </div>

        <div className="to-search">
          <input
            className="to-input"
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); setResult(null); setSpxTracking(null); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Ví dụ: INXK37PRMDZ"
            autoFocus
          />
          <button
            className="to-btn"
            onClick={() => handleSearch()}
            disabled={loading || !code.trim()}
          >
            {loading ? 'Đang tìm...' : 'Tra cứu'}
          </button>
        </div>

        {error && <div className="to-error">{error}</div>}

        {order && (
          <div className="to-result">
            {/* 1. Status banner + progress */}
            <div className={`to-stage-banner to-stage--${order.fulfillment_status || 'new'}`}>
              <span className="to-stage-icon">{stage.icon}</span>
              <span className="to-stage-label">{stage.label}</span>
            </div>

            <div className="to-progress-wrap">
              <div className="to-progress-bar">
                <div className="to-progress-fill" style={{ width: `${stage.pct}%` }} />
              </div>
              <div className="to-steps">
                {STEPS.map((s, i) => (
                  <div key={s.key} className={`to-step${i <= curStep ? ' to-step--done' : ''}`}>
                    <div className="to-step-dot" />
                    <div className="to-step-label">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Order items */}
            {order.items?.length > 0 && (
              <div className="to-items-section">
                <h2 className="to-section-title">Chi tiết đơn hàng</h2>
                <div className="to-items-list">
                  {order.items.map((item, index) => (
                    <div className="to-item-card" key={`${item.product_id}-${index}`}>
                      <div className="to-item-main">
                        {item.image_urls?.[0] ? (
                          <img className="to-item-img" src={item.image_urls[0]} alt={item.product_name} />
                        ) : (
                          <div className="to-item-img to-item-img--empty">📦</div>
                        )}
                        <div className="to-item-info">
                          <div className="to-item-name">{item.product_name}</div>
                          <div className="to-item-meta">
                            SL: {item.quantity} × {formatMoney(Number(item.unit_price))}
                          </div>
                          {item.note && <div className="to-item-note">Ghi chú: {item.note}</div>}
                        </div>
                        <div className="to-item-price">{formatMoney(itemSubtotal(item))}</div>
                      </div>
                      {(item.image_urls?.length ?? 0) > 1 && (
                        <div className="to-item-thumbs">
                          {item.image_urls.slice(1).map((url, imgIndex) => (
                            <img key={`${url}-${imgIndex}`} src={url} alt="" className="to-item-thumb" />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Order info */}
            <div className="to-info-grid">
              <div className="to-info-row">
                <span className="to-info-label">Mã đơn hàng (invoice)</span>
                <span className="to-info-value to-info-code">{order.invoice_number}</span>
              </div>
              <div className="to-info-row">
                <span className="to-info-label">Tên khách hàng</span>
                <span className="to-info-value">{order.customer_name}</span>
              </div>
              <div className="to-info-row">
                <span className="to-info-label">Thanh toán</span>
                <span className="to-info-value">{paymentLabel(order.payment_status)}</span>
              </div>
              <div className="to-info-row">
                <span className="to-info-label">Tổng tiền</span>
                <span className="to-info-value">{formatMoney(Number(order.total_amount))}</span>
              </div>
              <div className="to-info-row">
                <span className="to-info-label">Ngày đặt</span>
                <span className="to-info-value">{formatDate(order.created_at)}</span>
              </div>
              {order.tracking_code && (
                <div className="to-info-row">
                  <span className="to-info-label">Mã vận đơn</span>
                  <span className="to-info-value to-tracking-code">{order.tracking_code}</span>
                </div>
              )}
              {order.shipping_carrier && (
                <div className="to-info-row">
                  <span className="to-info-label">Đơn vị vận chuyển</span>
                  <span className="to-info-value">{order.shipping_carrier}</span>
                </div>
              )}
            </div>

            {result.type === 'qr' && order.payment_status === 'paid' && (
              <div className="to-qr-cta">
                <Link to={`/qr/${order.invoice_number}`} className="to-qr-cta-btn">
                  Tạo mã QR in →
                </Link>
              </div>
            )}

            {/* 4. SPX delivery timeline */}
            {showSpx && (
              <div className="to-spx-section">
                <div className="to-spx-header">
                  <img src="/assets/images/shipping/spx.png" alt="SPX" className="to-spx-logo" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  <span className="to-spx-title">Theo dõi vận chuyển SPX</span>
                </div>

                {spxLoading && <div className="to-spx-loading">Đang tải lộ trình giao hàng...</div>}

                {spxTracking && (
                  <>
                    <div className="to-spx-summary">
                      <div className="to-spx-waybill">
                        Mã Vận Đơn: <strong>{spxTracking.spx_tn}</strong>
                      </div>
                      <span className={`to-spx-status ${spxStatusClass(spxTracking.status_group)}`}>
                        {spxTracking.status}
                      </span>
                    </div>
                    {spxTracking.delivery_date && (
                      <div className="to-spx-delivery-date">📅 Ngày giao hàng: {spxTracking.delivery_date}</div>
                    )}

                    <div className="to-spx-milestones">
                      {spxTracking.milestones.map((m, i) => (
                        <div key={m.key} className={`to-spx-milestone${m.done ? ' to-spx-milestone--done' : ''}`}>
                          <div className="to-spx-milestone-icon">{SPX_STEP_ICONS[m.key] ?? '•'}</div>
                          <div className="to-spx-milestone-label">{m.label}</div>
                          {i < spxTracking.milestones.length - 1 && (
                            <div className={`to-spx-milestone-line${m.done ? ' to-spx-milestone-line--done' : ''}`} />
                          )}
                        </div>
                      ))}
                    </div>

                    {spxTracking.events.length > 0 && (
                      <div className="to-spx-timeline">
                        {spxTracking.events.map((ev, i) => (
                          <div key={`${ev.time}-${ev.date}-${i}`} className={`to-spx-event${i === 0 ? ' to-spx-event--latest' : ''}`}>
                            <div className="to-spx-event-dot" />
                            <div className="to-spx-event-content">
                              <div className="to-spx-event-time">{ev.time} | {ev.date}</div>
                              <div className="to-spx-event-desc">{ev.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 4b. Non-SPX carriers — tracking code already shown in info grid above */}
          </div>
        )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

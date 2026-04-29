import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './CheckoutResultPage.css';

type Status = 'success' | 'error' | 'cancel';

// Drop GIF files into frontend-app/public/checkout/:
//   success.gif  →  shown on successful payment
//   error.gif    →  shown on payment failure
//   cancel.gif   →  shown when user cancels
// If a GIF is missing the coloured SVG icon is rendered as fallback.
const GIF: Record<Status, string> = {
  success: '/assets/images/checkout/success.gif',
  error:   '/assets/images/checkout/error.gif',
  cancel:  '/assets/images/checkout/cancel.gif',
};

const CONTENT: Record<Status, { heading: string; body: string; cta: string; ctaHref: string }> = {
  success: {
    heading: 'Đặt hàng thành công!',
    body:    'Cảm ơn bạn đã tin tưởng In Ảnh Xink. Chúng mình sẽ liên hệ xác nhận và chuẩn bị đơn hàng sớm nhất có thể.',
    cta:     'Tiếp tục mua sắm',
    ctaHref: '/home',
  },
  error: {
    heading: 'Thanh toán thất bại',
    body:    'Đã có lỗi xảy ra trong quá trình thanh toán. Vui lòng thử lại hoặc liên hệ với chúng mình qua Zalo.',
    cta:     'Về trang chủ',
    ctaHref: '/home',
  },
  cancel: {
    heading: 'Đã huỷ thanh toán',
    body:    'Bạn đã huỷ quá trình thanh toán. Đơn hàng vẫn được lưu — bạn có thể thanh toán lại bất cứ lúc nào.',
    cta:     'Về trang chủ',
    ctaHref: '/home',
  },
};

function StatusIcon({ status }: { status: Status }) {
  const gif = GIF[status];
  const [hasGif, setHasGif] = React.useState(true);

  if (hasGif) {
    return (
      <img
        className="cr-gif-icon"
        src={gif}
        alt={status}
        onError={() => setHasGif(false)}
      />
    );
  }

  // SVG fallbacks
  return (
    <div className={`cr-icon cr-icon--${status}`}>
      {status === 'success' && (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {status === 'error' && (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      )}
      {status === 'cancel' && (
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      )}
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

export default function CheckoutResultPage() {
  const [params] = useSearchParams();
  const rawStatus = params.get('status') as Status | null;
  const status: Status = rawStatus && rawStatus in CONTENT ? rawStatus : 'error';
  const { heading, body, cta, ctaHref } = CONTENT[status];

  // SePay appends these to the callback URL
  const invoiceNumber = params.get('order_invoice_number') ?? params.get('invoice_number') ?? '';
  const rawAmount     = params.get('order_amount') ?? params.get('amount') ?? '';
  const amount        = rawAmount ? parseFloat(rawAmount) : null;

  return (
    <div className="cr-page">
      <SiteHeader />
      <main className="cr-main">
        <div className="cr-card">

          {/* Status icon — GIF if available, SVG fallback */}
          <StatusIcon status={status} />

          <h1 className="cr-heading">{heading}</h1>
          <p className="cr-body">{body}</p>

          {/* Order summary box — shown when we have data from SePay */}
          {(amount || invoiceNumber) && (
            <div className="cr-order-summary">
              {amount && (
                <div className="cr-order-row">
                  <span>Số tiền</span>
                  <strong>{fmt(amount)}</strong>
                </div>
              )}
              {invoiceNumber && (
                <div className="cr-order-row">
                  <span>Mã đơn hàng</span>
                  <strong>{invoiceNumber}</strong>
                </div>
              )}
            </div>
          )}

          {status !== 'success' && (
            <a
              href="https://zalo.me/0582818580"
              target="_blank"
              rel="noopener noreferrer"
              className="cr-zalo-btn"
            >
              <img src="/zalo_icon.svg.webp" alt="Zalo" className="cr-zalo-icon" />
              Liên hệ Zalo để được hỗ trợ
            </a>
          )}

          <Link to={ctaHref} className="cr-cta-btn">{cta}</Link>

          <div className="cr-brand">
            <img src="/logo.jpeg" alt="In Ảnh Xink" />
            In Ảnh Xink · inanhxink.com
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

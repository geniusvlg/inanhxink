import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './CheckoutResultPage.css';

const GIF = '/assets/images/checkout/success.gif';

function StatusIcon() {
  const [hasGif, setHasGif] = React.useState(true);
  if (hasGif) {
    return (
      <img
        className="cr-gif-icon"
        src={GIF}
        alt="success"
        onError={() => setHasGif(false)}
      />
    );
  }
  return (
    <div className="cr-icon cr-icon--success">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

export default function CheckoutResultPage() {
  const [params] = useSearchParams();
  const invoiceNumber = params.get('invoice_number') ?? '';
  const rawAmount     = params.get('amount') ?? '';
  const amount        = rawAmount ? parseFloat(rawAmount) : null;

  return (
    <div className="cr-page">
      <SiteHeader />
      <main className="cr-main">
        <div className="cr-card">
          <StatusIcon />

          <h1 className="cr-heading">Đặt hàng thành công!</h1>
          <p className="cr-body">
            Cảm ơn bạn đã tin tưởng In Ảnh Xink. Chúng mình sẽ liên hệ xác nhận và chuẩn bị đơn hàng sớm nhất có thể.
          </p>

          {(amount || invoiceNumber) && (
            <div className="cr-order-summary">
              {invoiceNumber && (
                <div className="cr-order-row">
                  <span>Mã đơn hàng</span>
                  <strong>{invoiceNumber}</strong>
                </div>
              )}
              {amount && (
                <div className="cr-order-row">
                  <span>Số tiền</span>
                  <strong>{fmt(amount)}</strong>
                </div>
              )}
            </div>
          )}

          <Link to="/home" className="cr-cta-btn">Tiếp tục mua sắm</Link>

          {invoiceNumber && (
            <Link to={`/theo-doi-don-hang?code=${invoiceNumber}`} className="cr-track-link">
              📦 Theo dõi đơn hàng #{invoiceNumber}
            </Link>
          )}

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

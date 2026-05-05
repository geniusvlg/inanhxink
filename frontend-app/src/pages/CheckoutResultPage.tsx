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
            Cảm ơn bạn đã tin tưởng In Ảnh Xink! Vui lòng gửi ảnh qua Zalo kèm mã đơn hàng để shop xử lý đúng đơn nhé 🥰
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

          {invoiceNumber && (
            <div className="cr-zalo-hint">
              <p className="cr-zalo-hint-text">
                Nhắn Zalo cho shop, gửi ảnh kèm mã&nbsp;
                <strong className="cr-zalo-hint-code">{invoiceNumber}</strong>
                <br />
                <span className="cr-zalo-hint-sub">Tối đa 20 ảnh mỗi sản phẩm.</span>
              </p>
              <a
                href="https://zalo.me/0_REPLACE_WITH_ZALO_OA"
                target="_blank"
                rel="noopener noreferrer"
                className="cr-zalo-btn"
              >
                <svg className="cr-zalo-svg" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="48" rx="10" fill="#0068FF"/>
                  <path d="M24 8C15.163 8 8 14.716 8 23c0 4.685 2.3 8.874 5.902 11.698L12.5 40l5.62-2.953A17.2 17.2 0 0024 38c8.837 0 16-6.716 16-15S32.837 8 24 8Z" fill="white"/>
                  <path d="M16 22h6M16 26h4M28 22l-4 4h4" stroke="#0068FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Nhắn Zalo cho shop
              </a>
            </div>
          )}

          <Link to="/home" className="cr-cta-btn">Tiếp tục mua sắm</Link>

          {invoiceNumber && (
            <Link to={`/tra-cuu-don-hang?code=${encodeURIComponent(invoiceNumber)}`} className="cr-track-link">
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

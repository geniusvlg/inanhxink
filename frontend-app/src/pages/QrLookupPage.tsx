import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getPaymentByQrName } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './QrLookupPage.css';

function sanitizeQrName(raw: string) {
  return raw.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function QrHeroIcon() {
  return (
    <svg className="ql-hero-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="24" rx="3" stroke="#fe2c56" strokeWidth="4" />
      <rect x="12" y="12" width="8" height="8" fill="#fe2c56" />
      <rect x="36" y="4" width="24" height="24" rx="3" stroke="#fe2c56" strokeWidth="4" />
      <rect x="44" y="12" width="8" height="8" fill="#fe2c56" />
      <rect x="4" y="36" width="24" height="24" rx="3" stroke="#fe2c56" strokeWidth="4" />
      <rect x="12" y="44" width="8" height="8" fill="#fe2c56" />
      <rect x="36" y="36" width="8" height="8" fill="#fe2c56" />
      <rect x="52" y="36" width="8" height="8" fill="#fe2c56" />
      <rect x="36" y="52" width="8" height="8" fill="#fe2c56" />
      <rect x="52" y="52" width="8" height="8" fill="#fe2c56" />
    </svg>
  );
}

export default function QrLookupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [qrName, setQrName] = useState(sanitizeQrName(searchParams.get('name') ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unpaidQrName, setUnpaidQrName] = useState('');

  useEffect(() => {
    const initial = searchParams.get('name');
    if (initial) {
      handleLookup(initial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLookup = async (rawName?: string) => {
    const name = sanitizeQrName(rawName ?? qrName);
    if (!name) return;

    setLoading(true);
    setError('');
    setUnpaidQrName('');

    try {
      const res = await getPaymentByQrName(name);
      if (!res.success) {
        setError('Không tìm thấy đơn hàng với tên QR này. Vui lòng kiểm tra lại.');
        return;
      }

      if (res.order.paymentStatus !== 'paid') {
        setUnpaidQrName(name);
        setError('Đơn hàng chưa được thanh toán. Vui lòng hoàn tất thanh toán trước khi tạo mã QR.');
        return;
      }

      navigate(`/qr/${name}`);
    } catch {
      setError('Không tìm thấy đơn hàng với tên QR này. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ql-layout">
      <SiteHeader activePage="tao-ma-qr" />
      <div className="ql-page">
        <div className="ql-container">
          <div className="ql-hero">
            <QrHeroIcon />
            <h1 className="ql-title">Tạo mã QR</h1>
            <p className="ql-subtitle">
              Nhập <strong>tên QR</strong> bạn đã chọn khi đặt hàng — ví dụ nếu trang của bạn là{' '}
              <strong>anhyeuem.inanhxink.com</strong> thì tên QR là <strong>anhyeuem</strong>.
            </p>
          </div>

          <div className="ql-search">
            <input
              className="ql-input"
              type="text"
              value={qrName}
              onChange={e => {
                setQrName(sanitizeQrName(e.target.value));
                setError('');
                setUnpaidQrName('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="Ví dụ: anhyeuem"
              autoFocus
            />
            <button
              className="ql-btn"
              onClick={() => handleLookup()}
              disabled={loading || !qrName.trim()}
            >
              {loading ? 'Đang kiểm tra...' : 'Tiếp tục'}
            </button>
          </div>

          {qrName && (
            <div className="ql-preview-url">
              Trang của bạn: <strong>{qrName}.inanhxink.com</strong>
            </div>
          )}

          {error && (
            <div className="ql-error">
              {error}
              {unpaidQrName && (
                <Link to={`/payment/${unpaidQrName}`} className="ql-pay-link">
                  Thanh toán ngay →
                </Link>
              )}
            </div>
          )}

          <div className="ql-help">
            <h2 className="ql-help-title">Hướng dẫn nhanh</h2>
            <ol className="ql-help-list">
              <li>Đặt QR Yêu Thương và chọn tên trang (tên QR) của bạn.</li>
              <li>Hoàn tất thanh toán — sau đó bạn sẽ được chuyển sang trang tạo mã QR.</li>
              <li>Quay lại trang này bất cứ lúc nào để tạo lại hoặc tải mã QR về máy.</li>
            </ol>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

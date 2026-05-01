import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import { getProductPayment, type ProductPaymentResponse } from '../services/api';
import { useCart } from '../contexts/CartContext';
import './ProductCheckoutPaymentPage.css';

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

function formatCountdown(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ProductCheckoutPaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const cart = useCart();
  const [data, setData] = useState<ProductPaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [pollExpired, setPollExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(2 * 60);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedOrderId = Number(orderId);

  const goToSuccess = (nextData: ProductPaymentResponse) => {
    cart.resetSession(); // payment confirmed — clear cart and rotate session
    const params = new URLSearchParams({
      invoice_number: nextData.order.invoiceNumber,
      amount:         String(nextData.order.totalAmount),
    });
    navigate(`/checkout/result?${params.toString()}`, { replace: true });
  };

  useEffect(() => {
    if (!parsedOrderId) {
      navigate('/checkout', { replace: true });
      return;
    }

    let cancelled = false;
    const loadPayment = async () => {
      try {
        const res = await getProductPayment(parsedOrderId);
        if (cancelled) return;
        setData(res);
        if (res.order.paymentStatus === 'paid') {
          goToSuccess(res);
          return;
        }
      } catch (err) {
        if (!cancelled) {
          const e = err as { response?: { data?: { error?: string } } };
          setError(e.response?.data?.error || 'Không tìm thấy đơn hàng');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadPayment();
    return () => { cancelled = true; };
  }, [parsedOrderId, navigate]);

  useEffect(() => {
    if (!parsedOrderId || !data || data.order.paymentStatus === 'paid') return;

    const timeoutId = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setPollExpired(true);
    }, 2 * 60 * 1000);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await getProductPayment(parsedOrderId);
        setData(res);
        if (res.order.paymentStatus === 'paid') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          clearTimeout(timeoutId);
          goToSuccess(res);
        }
      } catch {
        // Keep polling; transient network errors should not interrupt checkout.
      }
    }, 2000);

    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      clearTimeout(timeoutId);
    };
  }, [parsedOrderId, data?.order.paymentStatus]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  return (
    <div className="pcp-page">
      <SiteHeader />

      <main className="pcp-main">
        <div className="pcp-card">
          <button type="button" onClick={() => navigate('/checkout')} className="pcp-back-button">
            ← Quay lại chỉnh sửa đơn hàng
          </button>

          <h1 className="pcp-title">Thanh toán đơn hàng</h1>
          <p className="pcp-desc">Quét mã QR bằng app ngân hàng. Trang sẽ tự cập nhật khi nhận được tiền.</p>

          {loading && <PageLoader />}

          {!loading && error && (
            <div className="pcp-error">{error}</div>
          )}

          {!loading && data && (
            <>
              <div className="pcp-qr-container">
                <img src={data.payment.qrUrl} alt="QR thanh toán" />
              </div>

              <div className="pcp-bank-info">
                <div className="pcp-bank-row">
                  <span className="pcp-bank-label">Ngân hàng</span>
                  <strong className="pcp-bank-value">{data.payment.bank}</strong>
                </div>
                <div className="pcp-bank-row">
                  <span className="pcp-bank-label">Tên tài khoản</span>
                  <strong className="pcp-bank-value">{data.payment.accountName}</strong>
                </div>
                <div className="pcp-bank-row">
                  <span className="pcp-bank-label">Số tài khoản</span>
                  <strong className="pcp-bank-value">
                    {data.payment.accountNo}
                    <button
                      type="button"
                      className="pcp-copy-button"
                      onClick={() => handleCopy(data.payment.accountNo, 'account')}
                    >
                      {copied === 'account' ? 'Đã copy' : 'Copy'}
                    </button>
                  </strong>
                </div>
                <div className="pcp-bank-row">
                  <span className="pcp-bank-label">Nội dung CK</span>
                  <strong className="pcp-bank-value">
                    {data.payment.paymentCode}
                    <button
                      type="button"
                      className="pcp-copy-button"
                      onClick={() => handleCopy(data.payment.paymentCode, 'code')}
                    >
                      {copied === 'code' ? 'Đã copy' : 'Copy'}
                    </button>
                  </strong>
                </div>
                <div className="pcp-bank-row">
                  <span className="pcp-bank-label">Số tiền</span>
                  <strong className="pcp-bank-value pcp-amount">{fmt(data.payment.amount)}</strong>
                </div>
              </div>

              {pollExpired ? (
                <div className="pcp-expired">
                  <p className="pcp-expired-text">
                    Chúng mình vẫn đang kiểm tra thanh toán của bạn.<br />
                    Nếu bạn đã chuyển tiền, đơn hàng sẽ được xử lý trong vài phút.
                  </p>
                  <button
                    type="button"
                    className="pcp-retry-button"
                    onClick={() => window.location.reload()}
                  >
                    Kiểm tra lại
                  </button>
                </div>
              ) : (
                <>
                  <div className="pcp-countdown">
                    Phiên thanh toán còn <span className={secondsLeft <= 60 ? 'pcp-countdown-urgent' : ''}>{formatCountdown(secondsLeft)}</span>
                  </div>
                  <div className="pcp-status pcp-status--pending">
                    Đang chờ thanh toán...
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

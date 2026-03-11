import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPayment, getPaymentByQrName } from '../services/api';
import './PaymentPage.css';

interface OrderInfo {
  id: number;
  qrName: string;
  fullUrl: string;
  totalAmount: number;
  paymentStatus: string;
}

interface PaymentData {
  qrUrl: string;
  amount: number;
  paymentCode: string;
  status: string;
}

function PaymentPage() {
  const { qrName } = useParams<{ qrName: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [isPaid, setIsPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [pollExpired, setPollExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(2 * 60);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load order and payment info by qrName
  useEffect(() => {
    if (!qrName) {
      navigate('/', { replace: true });
      return;
    }

    const loadPaymentInfo = async () => {
      try {
        const res = await getPaymentByQrName(qrName);
        if (!res.success) {
          setError('Không tìm thấy đơn hàng');
          setLoading(false);
          return;
        }

        setOrder(res.order);

        if (res.order.paymentStatus === 'paid') {
          setIsPaid(true);
          if (res.payment) setPayment(res.payment);
          setLoading(false);
          return;
        }

        // If payment already exists, use it
        if (res.payment) {
          setPayment(res.payment);
          if (res.payment.status === 'paid') {
            setIsPaid(true);
          }
          setLoading(false);
          return;
        }

        // Create payment if none exists
        const payRes = await createPayment(res.order.id);
        if (payRes.success) {
          setPayment(payRes.payment);
        } else {
          setError(payRes.error || 'Không thể tạo thanh toán');
        }
        setLoading(false);
      } catch (err) {
        const e = err as { response?: { data?: { error?: string }, status?: number } };
        if (e.response?.status === 404) {
          setError('Không tìm thấy đơn hàng');
        } else {
          setError(e.response?.data?.error || 'Có lỗi xảy ra');
        }
        setLoading(false);
      }
    };

    loadPaymentInfo();
  }, [qrName, navigate]);

  // Poll for payment status + countdown timer
  useEffect(() => {
    if (!order || isPaid) return;

    const POLL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

    const timeoutId = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setPollExpired(true);
    }, POLL_TIMEOUT_MS);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await getPaymentByQrName(order.qrName);
        if (res.success && (res.order.paymentStatus === 'paid' || res.payment?.status === 'paid')) {
          setIsPaid(true);
          if (res.payment) setPayment(res.payment);
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          clearTimeout(timeoutId);
        }
      } catch {
        // Silently ignore polling errors
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
  }, [order, isPaid]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 1500);
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="app">
        <div className="app-container payment-page">
          <h1 className="app-title">Inanhxink</h1>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="app">
        <div className="app-container payment-page">
          <h1 className="app-title">Inanhxink</h1>
          {error && <div className="error-message">{error}</div>}
          <button onClick={handleGoBack} className="payment-back-button">
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  // ── Payment confirmed — redirect to QR customization ─────────────────────
  if (isPaid) {
    navigate(`/qr/${order.qrName}`, { replace: true });
    return null;
  }

  // ── Payment QR page ──────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="app-container payment-page">
        <h1 className="app-title">Inanhxink</h1>

        <button onClick={handleGoBack} className="payment-back-button">
          Quay lại để sửa/thay đổi thông tin
        </button>

        {error && <div className="error-message">{error}</div>}

        {payment && (
          <>
            <div className="payment-qr-container">
              <img src={payment.qrUrl} alt="QR thanh toán" />
            </div>

            <div className="payment-bank-info">
              <div className="payment-bank-row">
                <span className="payment-bank-label">Số tài khoản:</span>
                <span className="payment-bank-value">
                  77741116868
                  <button
                    className="payment-copy-button"
                    onClick={() => handleCopy('77741116868', 'account')}
                    title="Sao chép"
                  >
                    {copied === 'account' ? '✓' : '📋'}
                  </button>
                </span>
              </div>
              <div className="payment-bank-row">
                <span className="payment-bank-label">Nội dung CK:</span>
                <span className="payment-bank-value">
                  {payment.paymentCode}
                  <button
                    className="payment-copy-button"
                    onClick={() => handleCopy(payment.paymentCode, 'code')}
                    title="Sao chép"
                  >
                    {copied === 'code' ? '✓' : '📋'}
                  </button>
                </span>
              </div>
              <div className="payment-bank-row">
                <span className="payment-bank-label">Số tiền:</span>
                <span className="payment-bank-value payment-amount">
                  {payment.amount.toLocaleString('en')}đ
                </span>
              </div>
            </div>

            {pollExpired ? (
              <div className="payment-status pending">
                Phiên thanh toán đã hết hạn. Vui lòng tải lại trang nếu bạn đã thanh toán.
              </div>
            ) : (
              <>
                <div className="payment-countdown">
                  Phiên thanh toán còn <span className={secondsLeft <= 60 ? 'payment-countdown-urgent' : ''}>{formatCountdown(secondsLeft)}</span>
                </div>
                <div className="payment-status pending">
                  Đang chờ thanh toán...
                </div>
              </>
            )}

            <p className="payment-note">
              Quét mã QR bằng app ngân hàng để thanh toán.<br />
              Trang sẽ tự động cập nhật khi nhận được tiền.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentPage;

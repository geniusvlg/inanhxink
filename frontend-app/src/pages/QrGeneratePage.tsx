import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import StyledQRCode from '../components/QRCode';
import { getPaymentByQrName } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './QrGeneratePage.css';

const QR_TEMPLATES = [
  { id: 'qr', name: 'Mã QR', thumbnail: '/assets/images/qr-template/qr.png' },
  { id: 'heart', name: 'Heart', thumbnail: '/assets/images/qr-template/heart1.png' },
  { id: 'banhdeo', name: 'Bánh Dẻo', thumbnail: '/assets/images/qr-template/banhdeo.png' },
  { id: 'capturedmoments', name: 'Captured Moments', thumbnail: '/assets/images/qr-template/capturedmoments.png' },
];

function QrGeneratePage() {
  const { qrName } = useParams<{ qrName: string }>();
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState('heart');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const qrImgRef = useRef<HTMLImageElement>(null);

  const domain = 'inanhxink.com';
  const fullUrl = `https://${qrName}.${domain}`;

  useEffect(() => {
    if (!qrName) {
      navigate('/tao-ma-qr', { replace: true });
      return;
    }

    const verify = async () => {
      try {
        const res = await getPaymentByQrName(qrName);
        if (!res.success) {
          setError('Không tìm thấy đơn hàng.');
          setLoading(false);
          return;
        }
        if (res.order.paymentStatus !== 'paid') {
          navigate(`/payment/${qrName}`, { replace: true });
          return;
        }
        setLoading(false);
      } catch {
        setError('Không tìm thấy đơn hàng.');
        setLoading(false);
      }
    };

    verify();
  }, [qrName, navigate]);

  const handleGenerate = () => {
    setGenerated(true);
  };

  const handleDownload = () => {
    const img = qrImgRef.current;
    if (!img?.src) return;
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `qr-${qrName}-${selectedTemplate}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="qrg-layout">
        <SiteHeader activePage="tao-ma-qr" />
        <div className="qrg-page">
          <div className="qrg-container">
            <PageLoader />
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="qrg-layout">
        <SiteHeader activePage="tao-ma-qr" />
        <div className="qrg-page">
          <div className="qrg-container qrg-container--center">
            <div className="qrg-error">{error}</div>
            <Link to="/tao-ma-qr" className="qrg-back-link">← Quay lại tra cứu</Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="qrg-layout">
      <SiteHeader activePage="tao-ma-qr" />
      <div className="qrg-page">
        <div className="qrg-container">
          <h1 className="qrg-title">Tạo mã QR</h1>
          <p className="qrg-subtitle">
            Chọn khung QR yêu thích, tải về và in hoặc chia sẻ cho người thân.
          </p>

          <div className="qr-gen-url-display">
            <span className="qr-gen-url-label">URL của bạn:</span>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer" className="qr-gen-url-value">
              {fullUrl}
            </a>
          </div>

          <div className="qr-gen-section">
            <div className="qr-gen-label">Chọn khung QR:</div>
            <div className="qr-gen-templates">
              {QR_TEMPLATES.map((t) => (
                <div
                  key={t.id}
                  className={`qr-gen-template-card ${selectedTemplate === t.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedTemplate(t.id);
                    setGenerated(false);
                  }}
                >
                  {t.thumbnail
                    ? <img src={t.thumbnail} alt={t.name} />
                    : <div className="qr-gen-template-plain">QR</div>
                  }
                  <span>{t.name}</span>
                </div>
              ))}
            </div>
          </div>

          <button className="qr-gen-button" onClick={handleGenerate}>
            Tạo QR
          </button>

          {generated && (
            <div className="qr-gen-result">
              <StyledQRCode url={fullUrl} template={selectedTemplate} imgRef={qrImgRef} />
              <button type="button" className="qr-gen-download" onClick={handleDownload}>
                Tải ảnh QR về máy
              </button>
            </div>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

export default QrGeneratePage;

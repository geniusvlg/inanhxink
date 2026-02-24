import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './QrCodePage.css';

/**
 * In the TokiToki subdomain architecture, template pages are served directly
 * by Express at {qrName}.inanhxink.com — not via React Router.
 *
 * This page exists only as a convenience redirect: if someone accesses
 * order.inanhxink.com/qr/anhle they get redirected to anhle.inanhxink.com.
 */
function QrCodePage() {
  const { qrName } = useParams<{ qrName: string }>();

  const targetUrl = qrName
    ? `https://${qrName}.${import.meta.env.VITE_DOMAIN || 'inanhxink.com'}`
    : null;

  useEffect(() => {
    if (targetUrl) {
      window.location.replace(targetUrl);
    }
  }, [targetUrl]);

  if (!qrName) {
    return (
      <div className="qr-code-page error">
        <div className="error-text">QR code not found</div>
      </div>
    );
  }

  return (
    <div className="qr-code-page loading">
      <div className="loading-text">
        Đang chuyển hướng tới{' '}
        <a href={targetUrl!} style={{ color: '#e63b7a' }}>
          {targetUrl}
        </a>
        …
      </div>
    </div>
  );
}

export default QrCodePage;

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getQrCodeByName } from '../services/api';
import LoveLetter from '../components/templates/LoveLetter';
import './QrCodePage.css';

interface QrCode {
  template?: {
    name?: string;
  };
  contentLines: string[];
}

function QrCodePage() {
  const { qrName } = useParams<{ qrName: string }>();
  const [qrCode, setQrCode] = useState<QrCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadQrCode();
  }, [qrName]);

  const loadQrCode = async () => {
    if (!qrName) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getQrCodeByName(qrName);
      
      if (response.success) {
        setQrCode(response.qrCode);
      } else {
        setError('QR code not found');
      }
    } catch (err) {
      console.error('Error loading QR code:', err);
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Failed to load QR code');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="qr-code-page loading">
        <div className="loading-text">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="qr-code-page error">
        <div className="error-text">{error}</div>
      </div>
    );
  }

  if (!qrCode) {
    return (
      <div className="qr-code-page error">
        <div className="error-text">QR code not found</div>
      </div>
    );
  }

  // Render template based on template name
  const renderTemplate = () => {
    const templateName = qrCode.template?.name?.toLowerCase() || '';
    
    if (templateName.includes('love letter') || templateName.includes('letter')) {
      return <LoveLetter contentLines={qrCode.contentLines} />;
    }
    
    // Default fallback
    return (
      <div className="default-template">
        <h1>{qrCode.template?.name || 'QR Code'}</h1>
        <div className="content">
          {qrCode.contentLines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="qr-code-page">
      {renderTemplate()}
    </div>
  );
}

export default QrCodePage;


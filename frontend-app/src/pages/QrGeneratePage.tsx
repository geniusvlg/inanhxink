import { useState } from 'react';
import { useParams } from 'react-router-dom';
import StyledQRCode from '../components/QRCode';
import './QrGeneratePage.css';

const QR_TEMPLATES = [
  { id: 'qr', name: 'Mã QR', thumbnail: '/assets/images/qr-template/qr.png' },
  { id: 'heart', name: 'Heart', thumbnail: '/assets/images/qr-template/heart1.png' },
  { id: 'banhdeo', name: 'Bánh Dẻo', thumbnail: '/assets/images/qr-template/banhdeo.png' },
  { id: 'capturedmoments', name: 'Captured Moments', thumbnail: '/assets/images/qr-template/capturedmoments.png' },
];

function QrGeneratePage() {
  const { qrName } = useParams<{ qrName: string }>();
  const [selectedTemplate, setSelectedTemplate] = useState('heart');
  const [generated, setGenerated] = useState(false);

  const domain = 'inanhxink.com';
  const fullUrl = `https://${qrName}.${domain}`;

  const handleGenerate = () => {
    setGenerated(true);
  };

  return (
    <div className="app">
      <div className="app-container qr-generate-page">
        <h1 className="app-title">Tạo mã QR</h1>

        <div className="qr-gen-url-display">
          <span className="qr-gen-url-label">URL của bạn:</span>
          <span className="qr-gen-url-value">{fullUrl}</span>
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
            <StyledQRCode url={fullUrl} template={selectedTemplate} />
          </div>
        )}
      </div>
    </div>
  );
}

export default QrGeneratePage;

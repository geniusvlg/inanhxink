import { useState, useEffect } from 'react';
import '../App.css';
import TemplateSelector from '../components/TemplateSelector';
import QrNameInput from '../components/QrNameInput';
import ContentEditor from '../components/ContentEditor';
import MusicOption from '../components/MusicOption';
import TipSelector from '../components/TipSelector';
import VoucherInput from '../components/VoucherInput';
import ImageUploader from '../components/ImageUploader';
import { type Template } from '../data/mockTemplates';
import { createOrder, uploadFiles } from '../services/api';

// Map frontend template IDs → backend template_type folder names
const TEMPLATE_TYPE_MAP: Record<string, string> = {
  letterinspace: 'galaxy',
  christmastree: 'christmas',
  loveletter: 'loveletter',
};

// Template types that require image uploads
const TEMPLATES_WITH_IMAGES = new Set(['letterinspace', 'christmastree', 'loveletter', 'heartmosaic']);

// Template types that require letter content
const TEMPLATES_WITH_CONTENT = new Set([
  'loveletter', 'echoheart', 'letterinspace', 'christmastree',
  'stellarbloom', 'chillroom', 'lovehex', 'dearsky', 'message',
  'lanternia', 'lovecount', 'crystalrose', 'snowheart', 'birthdaycake',
  'captured', 'puzzlelove', 'gacha',
]);

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

interface OrderSuccess {
  qrName: string;
  fullUrl: string;
  templateType: string;
}

function OrderPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [qrName, setQrName] = useState('');
  const [qrNameValid, setQrNameValid] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [content, setContent] = useState('');
  const [musicAdded, setMusicAdded] = useState(false);
  const [musicLink, setMusicLink] = useState('');
  const [keychainPurchased, setKeychainPurchased] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | 'custom' | null>(null);
  const [customTipAmount, setCustomTipAmount] = useState(0);
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<OrderSuccess | null>(null);
  const [error, setError] = useState('');
  const [uploadedImages, setUploadedImages] = useState<(File | null)[]>([]);

  const templateId = selectedTemplate?.id || '';
  const templateType = TEMPLATE_TYPE_MAP[templateId] || templateId;
  const needsImages = TEMPLATES_WITH_IMAGES.has(templateId);
  const needsContent = TEMPLATES_WITH_CONTENT.has(templateId);

  // Auto-scroll when template changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const target = needsContent
      ? document.querySelector<HTMLElement>('.content-editor textarea, .content-editor')
      : document.querySelector<HTMLElement>('.image-uploader-header');
    if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  }, [selectedTemplate]);

  const calculateTotal = () => {
    let subtotal = selectedTemplate ? selectedTemplate.price : 0;
    const MUSIC_PRICE = 10000;
    if (musicAdded) subtotal += MUSIC_PRICE;
    const tipAmount = selectedTip === 'custom' ? customTipAmount : (selectedTip || 0);
    subtotal += tipAmount;
    let total = subtotal;
    if (voucher) {
      if (voucher.discountType === 'percentage') {
        total = subtotal * (1 - voucher.discountValue / 100);
      } else {
        total = Math.max(0, subtotal - voucher.discountValue);
      }
    }
    return {
      subtotal: Math.round(subtotal),
      total: Math.round(total),
      discount: Math.round(subtotal - total),
    };
  };

  const handleQrNameValidation = (isValid: boolean, fullUrl?: string) => {
    setQrNameValid(isValid);
    setQrUrl(fullUrl || '');
  };

  const handleVoucherValidated = (voucherData: Voucher | null) => {
    setVoucher(voucherData);
  };

  const handleClearAll = () => {
    if (window.confirm('Bạn có chắc muốn xóa toàn bộ dữ liệu đã nhập?')) {
      setSelectedTemplate(null);
      setQrName('');
      setQrNameValid(false);
      setQrUrl('');
      setContent('');
      setMusicAdded(false);
      setMusicLink('');
      setKeychainPurchased(false);
      setSelectedTip(null);
      setCustomTipAmount(0);
      setVoucher(null);
      setOrderSuccess(null);
      setError('');
      setUploadedImages([]);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedTemplate) { setError('Vui lòng chọn template'); return; }
    if (!qrName || !qrNameValid) { setError('Vui lòng nhập và kiểm tra tên QR hợp lệ'); return; }
    if (needsContent && !content.trim()) { setError('Vui lòng nhập nội dung'); return; }

    setSubmitting(true);
    try {
      // Upload images first (if any)
      const realFiles = uploadedImages.filter(Boolean) as File[];
      let imageUrls: string[] = [];
      if (realFiles.length > 0) {
        imageUrls = await uploadFiles(realFiles);
      }

      const tipAmount = selectedTip === 'custom' ? customTipAmount : (selectedTip || 0);

      const response = await createOrder({
        qrName,
        content: content.trim(),
        templateId: selectedTemplate.id,
        templateType,
        imageUrls,
        musicUrl: musicLink || undefined,
        musicAdded,
        keychainPurchased,
        tipAmount,
        voucherCode: voucher?.code,
      });

      if (response.success) {
        setOrderSuccess({
          qrName: response.qrCode.qrName,
          fullUrl: response.qrCode.fullUrl,
          templateType: response.qrCode.templateType,
        });
      } else {
        setError(response.error || 'Đặt hàng thất bại');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotal();

  // ── Success screen ──────────────────────────────────────────────────────────
  if (orderSuccess) {
    const liveUrl = `https://${orderSuccess.fullUrl}`;
    return (
      <div className="app">
        <div className="app-container" style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ color: '#e63b7a', marginBottom: '1rem' }}>Đặt hàng thành công!</h1>
          <p style={{ marginBottom: '0.5rem' }}>Trang của bạn sẽ sẵn sàng tại:</p>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              fontSize: '1.2rem',
              fontWeight: 700,
              color: '#fff',
              background: 'linear-gradient(135deg, #e63b7a, #ff512f)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              textDecoration: 'none',
              marginTop: '0.5rem',
              marginBottom: '2rem',
              wordBreak: 'break-all',
            }}
          >
            {liveUrl}
          </a>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2rem' }}>
            Sau khi thanh toán và chúng tôi xác nhận, trang sẽ được kích hoạt trong vài phút.
          </p>
          <button
            onClick={handleClearAll}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '0.5rem 1.5rem',
              cursor: 'pointer',
              color: '#555',
            }}
          >
            Đặt thêm
          </button>
        </div>
      </div>
    );
  }

  // ── Order form ──────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="app-container">
        <h1 className="app-title">Inanhxink</h1>

        {error && <div className="error-message">{error}</div>}

        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          onClearAll={handleClearAll}
        />

        <QrNameInput
          value={qrName}
          onChange={setQrName}
          onValidation={handleQrNameValidation}
        />

        {qrNameValid && qrUrl && (
          <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem', color: '#e63b7a', fontWeight: 600 }}>
            URL của bạn: <span style={{ textDecoration: 'underline' }}>{qrUrl}</span>
          </div>
        )}

        {needsContent && (
          <ContentEditor value={content} onChange={setContent} />
        )}

        {needsImages && (
          <ImageUploader
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={9}
            onImageSelected={() => {
              setTimeout(() => {
                const music = document.querySelector<HTMLElement>('.music-option');
                if (music) music.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 200);
            }}
          />
        )}

        <MusicOption
          musicAdded={musicAdded}
          onMusicToggle={setMusicAdded}
          musicLink={musicLink}
          onMusicLinkChange={setMusicLink}
        />

        <div className="keychain-option">
          <label>
            <input
              type="checkbox"
              checked={keychainPurchased}
              onChange={(e) => setKeychainPurchased(e.target.checked)}
            />
            Mua móc khóa quét QR (Đã bao gồm phí ship)
          </label>
        </div>

        <TipSelector
          selectedTip={selectedTip}
          onSelectTip={setSelectedTip}
          customAmount={customTipAmount}
          onCustomAmountChange={setCustomTipAmount}
        />

        <VoucherInput onVoucherValidated={handleVoucherValidated} />

        <div className="payment-section">
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedTemplate || !qrNameValid}
            className="payment-button"
          >
            {submitting
              ? 'Đang xử lý...'
              : `Thanh toán (${totals.total >= 1000 ? `${Math.round(totals.total / 1000)}k` : `${totals.total}đ`})`}
          </button>

          {totals.discount > 0 && (
            <div className="price-breakdown">
              <div className="price-line">
                <span>Giá gốc:</span>
                <span>{totals.subtotal.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="price-line discount">
                <span>Giảm giá:</span>
                <span>-{totals.discount.toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="price-line total">
                <span>Tổng cộng:</span>
                <span>{totals.total.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderPage;

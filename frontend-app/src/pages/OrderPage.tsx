import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

function OrderPage() {
  const navigate = useNavigate();
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
  const [error, setError] = useState('');
  const [uploadedImages, setUploadedImages] = useState<(File | null)[]>([]);

  const templateType = selectedTemplate?.template_type || '';

  // Auto-scroll when template changes
  useEffect(() => {
    if (!selectedTemplate) return;
    const target = document.querySelector<HTMLElement>('.content-editor textarea, .content-editor');
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
      setError('');
      setUploadedImages([]);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedTemplate) { setError('Vui lòng chọn template'); return; }
    if (!qrName || !qrNameValid) { setError('Vui lòng nhập và kiểm tra tên QR hợp lệ'); return; }
    if (!content.trim()) { setError('Vui lòng nhập nội dung'); return; }

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
        navigate(`/payment/${response.qrCode.qrName}`);
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

        <ContentEditor value={content} onChange={setContent} />

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

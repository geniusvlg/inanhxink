import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import '../App.css';
import TemplateSelector from '../components/TemplateSelector';
import QrNameInput from '../components/QrNameInput';
import ContentEditor from '../components/ContentEditor';
import LetterInSpaceForm from '../components/LetterInSpaceForm';
import MusicOption from '../components/MusicOption';
import TipSelector from '../components/TipSelector';
import VoucherInput from '../components/VoucherInput';
import ImageUploader from '../components/ImageUploader';
import { type Template } from '../data/mockTemplates';
import { createOrder, uploadFiles, getTemplate, getMetadata } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

function OrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [musicPrice, setMusicPrice] = useState(10000);
  const [keychainPrice, setKeychainPrice] = useState(35000);

  const templateType = selectedTemplate?.template_type || '';

  const preselectedTemplateId = searchParams.get('template');

  // Fetch prices from metadata
  useEffect(() => {
    getMetadata().then(data => {
      if (data.music_price) setMusicPrice(parseInt(data.music_price));
      if (data.keychain_price) setKeychainPrice(parseInt(data.keychain_price));
    }).catch(() => {});
  }, []);

  // Restore draft from sessionStorage on mount
  useEffect(() => {
    const draft = sessionStorage.getItem('orderFormDraft');
    if (draft) {
      try {
        const d = JSON.parse(draft);
        if (d.selectedTemplate) setSelectedTemplate(d.selectedTemplate);
        if (d.qrName) setQrName(d.qrName);
        if (d.qrNameValid) setQrNameValid(d.qrNameValid);
        if (d.qrUrl) setQrUrl(d.qrUrl);
        if (d.content) setContent(d.content);
        if (d.musicAdded) setMusicAdded(d.musicAdded);
        if (d.musicLink) setMusicLink(d.musicLink);
        if (d.keychainPurchased) setKeychainPurchased(d.keychainPurchased);
        if (d.selectedTip !== undefined) setSelectedTip(d.selectedTip);
        if (d.customTipAmount) setCustomTipAmount(d.customTipAmount);
        if (d.voucher) setVoucher(d.voucher);
        if (d.imagePreviews?.length) {
          setImagePreviews(d.imagePreviews);
          // Convert base64 previews back to File objects
          Promise.all(
            (d.imagePreviews as string[]).map(async (b64: string, i: number) => {
              if (!b64) return null;
              const res = await fetch(b64);
              const blob = await res.blob();
              return new File([blob], `image-${i}.jpg`, { type: blob.type });
            })
          ).then(files => setUploadedImages(files));
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('orderFormDraft');
    }
  }, []);

  // Auto-select template from URL param
  useEffect(() => {
    if (preselectedTemplateId && !selectedTemplate) {
      getTemplate(preselectedTemplateId).then((data) => {
        const t = data.template || data;
        setSelectedTemplate({ ...t, price: Number(t.price) });
      }).catch(() => {});
    }
  }, [preselectedTemplateId, selectedTemplate]);

  const calculateTotal = () => {
    let subtotal = selectedTemplate ? selectedTemplate.price : 0;
    if (musicAdded) subtotal += musicPrice;
    if (keychainPurchased) subtotal += keychainPrice;
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
      setImagePreviews([]);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedTemplate) { setError('Vui lòng chọn template'); return; }
    if (!qrName || !qrNameValid) { setError('Vui lòng nhập và kiểm tra tên QR hợp lệ'); return; }
    if (!content.trim()) { setError('Vui lòng nhập nội dung'); return; }
    if (musicAdded && !musicLink) { setError('Vui lòng xác nhận link nhạc trước khi thanh toán'); return; }

    setSubmitting(true);
    try {
      // Upload images first (if any)
      const realFiles = uploadedImages.filter(Boolean) as File[];
      let imageUrls: string[] = [];
      if (realFiles.length > 0) {
        imageUrls = await uploadFiles(realFiles, qrName);
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
        try {
          sessionStorage.setItem('orderFormDraft', JSON.stringify({
            selectedTemplate, qrName, qrNameValid, qrUrl, content,
            musicAdded, musicLink, keychainPurchased, selectedTip,
            customTipAmount, voucher,
            // Skip imagePreviews — base64 images can exceed iOS sessionStorage quota
          }));
        } catch { /* ignore quota errors — back-nav draft is optional */ }
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
  const orderFormTop = (
    <>
      <QrNameInput
        value={qrName}
        onChange={setQrName}
        onValidation={handleQrNameValidation}
      />

      {qrNameValid && qrUrl && (
        <div style={{ textAlign: 'center', margin: '0.5rem 0 1rem', color: '#f05448', fontWeight: 600 }}>
          URL của bạn: <span style={{ textDecoration: 'underline' }}>{qrUrl}</span>
        </div>
      )}

      {templateType === 'letterinspace'
        ? <LetterInSpaceForm value={content} onChange={setContent} />
        : <ContentEditor value={content} onChange={setContent} />
      }
    </>
  );

  const orderFormBottom = (
    <>
      {templateType !== 'letterinspace' && (
        <ImageUploader
          images={uploadedImages}
          onImagesChange={setUploadedImages}
          maxImages={9}
          onImageSelected={() => {}}
          initialPreviews={imagePreviews}
          onPreviewsChange={setImagePreviews}
        />
      )}

      <MusicOption
        musicAdded={musicAdded}
        onMusicToggle={setMusicAdded}
        musicLink={musicLink}
        onMusicLinkChange={setMusicLink}
        qrName={qrName}
        musicPrice={musicPrice}
      />

      <div className="keychain-option">
        <label>
          <input
            type="checkbox"
            checked={keychainPurchased}
            onChange={(e) => setKeychainPurchased(e.target.checked)}
          />
          Mua móc khóa quét QR <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>+{keychainPrice.toLocaleString('en')}đ</span>
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
        {!qrNameValid && (
          <div className="qr-name-reminder">
            <span className="qr-name-reminder-arrow">↑</span>
            <span>Nhập tên QR trước nhé!</span>
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
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
              <span>{totals.subtotal.toLocaleString('en')}đ</span>
            </div>
            <div className="price-line discount">
              <span>Giảm giá:</span>
              <span>-{totals.discount.toLocaleString('en')}đ</span>
            </div>
            <div className="price-line total">
              <span>Tổng cộng:</span>
              <span>{totals.total.toLocaleString('en')}đ</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Two-column product detail layout (preselected from homepage)
  if (preselectedTemplateId) {
    return (
      <div className="app">
        <div className="app-container app-container--wide">
          <Link to="/" className="back-link">&larr; Quay lại</Link>

          {selectedTemplate && (
            <>
              <div className="order-detail-layout">
                <div className="order-detail-left">
                  <img
                    className="order-detail-img"
                    src={selectedTemplate.image_url ? `${API_BASE_URL}${selectedTemplate.image_url}` : '/placeholder.png'}
                    alt={selectedTemplate.name}
                  />
                </div>
                <div className="order-detail-right">
                  <h1 className="order-detail-name">{selectedTemplate.name}</h1>
                  <div className="order-detail-price">{Math.round(selectedTemplate.price).toLocaleString('en')}đ</div>
                  {orderFormTop}
                </div>
              </div>
              {orderFormBottom}
            </>
          )}
        </div>
      </div>
    );
  }

  // Classic single-column layout (no preselection)
  return (
    <div className="app">
      <div className="app-container">
        <Link to="/" className="back-link">&larr; Quay lại</Link>
        <h1 className="app-title">Inanhxink</h1>

        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          onClearAll={handleClearAll}
        />

        {orderFormTop}
        {orderFormBottom}
      </div>
    </div>
  );
}

export default OrderPage;

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

interface Voucher {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
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
  const [orderResult, setOrderResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [uploadedImages, setUploadedImages] = useState<(File | null)[]>([]);

  // Auto-scroll based on selected template
  useEffect(() => {
    if (selectedTemplate?.id === 'echoheart') {
      setTimeout(() => {
        const contentEditor = document.querySelector('.content-editor textarea, .content-editor');
        if (contentEditor) {
          contentEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    } else if (selectedTemplate?.id === 'heartmosaic') {
      setTimeout(() => {
        const imageUploaderHeader = document.querySelector('.image-uploader-header');
        if (imageUploaderHeader) {
          imageUploaderHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);
    }
  }, [selectedTemplate]);

  const calculateTotal = () => {
    let subtotal = selectedTemplate ? selectedTemplate.price : 0;
    
    // Add music price if added (+10,000đ)
    const MUSIC_PRICE = 10000;
    if (musicAdded) {
      subtotal += MUSIC_PRICE;
    }
    
    // Add keychain price if purchased
    const KEYCHAIN_PRICE = 0; // Can be configured
    if (keychainPurchased) {
      subtotal += KEYCHAIN_PRICE;
    }
    
    // Add tip
    const tipAmount = selectedTip === 'custom' ? customTipAmount : (selectedTip || 0);
    subtotal += tipAmount;
    
    // Apply voucher discount
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
      setOrderResult(null);
      setError('');
      setUploadedImages([]);
    }
  };

  const handleSubmit = () => {
    setError('');
    
    // Validation
    if (!selectedTemplate) {
      setError('Vui lòng chọn template');
      return;
    }
    
    if (!qrName || !qrNameValid) {
      setError('Vui lòng nhập và kiểm tra tên QR hợp lệ');
      return;
    }
    
    if (!content.trim()) {
      setError('Vui lòng nhập nội dung');
      return;
    }
    
    // For display only - no API call
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      alert('Trang này chỉ để hiển thị, không gọi API');
    }, 500);
  };

  const totals = calculateTotal();

  return (
    <div className="app">
      <div className="app-container">
        <h1 className="app-title">Inanhxink</h1>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        
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
        
        <ContentEditor
          value={content}
          onChange={setContent}
        />
        
        {selectedTemplate?.id === 'heartmosaic' && (
          <ImageUploader
            images={uploadedImages}
            onImagesChange={setUploadedImages}
            maxImages={9}
            onImageSelected={() => {
              // Scroll to the next input section (Music Option)
              setTimeout(() => {
                const musicSection = document.querySelector('.music-option');
                if (musicSection) {
                  musicSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
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
            disabled={submitting || !selectedTemplate || !qrNameValid || !content.trim()}
            className="payment-button"
          >
            {submitting ? 'Đang xử lý...' : `Thanh toán (${totals.total >= 1000 ? `${Math.round(totals.total / 1000)}k` : `${totals.total}đ`})`}
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


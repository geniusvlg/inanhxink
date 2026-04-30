import { useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { useCart, cartEntriesToApiItems, type CartEntry } from '../contexts/CartContext';

const MAX_PRODUCT_IMAGES = 30;
import { createProductOrder, uploadProductImages } from '../services/api';
import './CheckoutPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CDN_URL      = import.meta.env.VITE_CDN_URL || '';
const S3_ORIGIN    = `https://s3-north1.viettelidc.com.vn/${import.meta.env.VITE_S3_BUCKET || 'inanhxink-prod'}`;
const resolveUrl   = (url: string) => {
  if (CDN_URL && url.startsWith(S3_ORIGIN)) return CDN_URL + url.slice(S3_ORIGIN.length);
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};

function fmt(n: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + 'đ';
}

interface CustomerInfo {
  name:    string;
  phone:   string;
  email:   string;
  address: string;
}

interface UploadSlot {
  id:          string;
  file:        File;
  previewUrl:  string;
  uploadedUrl: string;
  state:       'uploading' | 'done' | 'error';
}

interface ItemCustomisation {
  note:  string;
  slots: UploadSlot[];
}

function slotId() {
  return Math.random().toString(36).slice(2);
}

interface BuyNowDraft {
  sessionId: string;
  items:     CartEntry[];
}

function readBuyNowDraft(): BuyNowDraft | null {
  try {
    const raw = localStorage.getItem('buy_now_checkout');
    return raw ? (JSON.parse(raw) as BuyNowDraft) : null;
  } catch {
    return null;
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cart = useCart();
  const isBuyNow = searchParams.get('mode') === 'buy-now';
  const [buyNowDraft] = useState<BuyNowDraft | null>(() => readBuyNowDraft());

  const items = isBuyNow ? (buyNowDraft?.items ?? []) : cart.items;
  const sessionId = isBuyNow ? (buyNowDraft?.sessionId ?? '') : cart.sessionId;
  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  const [step,    setStep]    = useState<1 | 2>(1);
  const [busy,    setBusy]    = useState(false);
  const [errMsg,  setErrMsg]  = useState('');

  const [info, setInfo] = useState<CustomerInfo>({ name: '', phone: '', email: '', address: '' });

  const [customs, setCustoms] = useState<Record<number, ItemCustomisation>>(() =>
    Object.fromEntries(items.map(it => [it.product_id, { note: '', slots: [] }]))
  );
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  if (items.length === 0) {
    return (
      <div className="co-page">
        <SiteHeader />
        <main className="co-main co-empty">
          <p>{isBuyNow ? 'Không tìm thấy sản phẩm mua ngay.' : 'Giỏ hàng trống.'}</p>
          <button onClick={() => navigate('/home')} className="co-back-btn">Về trang chủ</button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const validateStep1 = (): boolean => {
    if (!info.name.trim())    { setErrMsg('Vui lòng nhập tên người nhận'); return false; }
    if (!info.phone.trim())   { setErrMsg('Vui lòng nhập số điện thoại'); return false; }
    if (!info.address.trim()) { setErrMsg('Vui lòng nhập địa chỉ giao hàng'); return false; }
    setErrMsg('');
    return true;
  };

  const handleStep1Submit = () => {
    if (validateStep1()) setStep(2);
  };

  const handleFileAdd = useCallback(async (productId: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const existingCount = customs[productId]?.slots.length ?? 0;
    const remaining = MAX_PRODUCT_IMAGES - existingCount;
    if (remaining <= 0) {
      alert(`Mỗi sản phẩm chỉ được upload tối đa ${MAX_PRODUCT_IMAGES} ảnh.`);
      return;
    }
    const newFiles = Array.from(fileList).slice(0, remaining);
    if (Array.from(fileList).length > remaining) {
      alert(`Chỉ còn ${remaining} chỗ trống. Đã thêm ${remaining} ảnh đầu tiên.`);
    }
    const newSlots: UploadSlot[] = newFiles.map(f => ({
      id:          slotId(),
      file:        f,
      previewUrl:  URL.createObjectURL(f),
      uploadedUrl: '',
      state:       'uploading' as const,
    }));
    setCustoms(prev => ({
      ...prev,
      [productId]: { ...prev[productId], slots: [...prev[productId].slots, ...newSlots] },
    }));
    const tryUpload = async () => uploadProductImages(newFiles, sessionId);
    let urls: string[];
    try {
      urls = await tryUpload();
    } catch {
      // Auto-retry once silently
      try {
        urls = await tryUpload();
      } catch {
        setCustoms(prev => {
          const updated = prev[productId].slots.map(s =>
            newSlots.some(ns => ns.id === s.id) ? { ...s, state: 'error' as const } : s
          );
          return { ...prev, [productId]: { ...prev[productId], slots: updated } };
        });
        if (fileRefs.current[productId]) fileRefs.current[productId]!.value = '';
        return;
      }
    }
    setCustoms(prev => {
      const updated = prev[productId].slots.map(s => {
        const idx = newSlots.findIndex(ns => ns.id === s.id);
        if (idx === -1) return s;
        return { ...s, uploadedUrl: urls[idx] ?? '', state: 'done' as const };
      });
      return { ...prev, [productId]: { ...prev[productId], slots: updated } };
    });
    if (fileRefs.current[productId]) fileRefs.current[productId]!.value = '';
  }, [sessionId]);

  const handleFileRemove = useCallback((productId: number, id: string) => {
    setCustoms(prev => {
      const slot = prev[productId].slots.find(s => s.id === id);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      return {
        ...prev,
        [productId]: { ...prev[productId], slots: prev[productId].slots.filter(s => s.id !== id) },
      };
    });
  }, []);

  const handleFileRetry = useCallback(async (productId: number, id: string) => {
    let fileToRetry: File | null = null;
    setCustoms(prev => {
      const slot = prev[productId].slots.find(s => s.id === id);
      if (!slot) return prev;
      fileToRetry = slot.file;
      const updated = prev[productId].slots.map(s =>
        s.id === id ? { ...s, state: 'uploading' as const } : s
      );
      return { ...prev, [productId]: { ...prev[productId], slots: updated } };
    });
    if (!fileToRetry) return;
    const tryUpload = async () => uploadProductImages([fileToRetry!], sessionId);
    let urls: string[];
    try {
      urls = await tryUpload();
    } catch {
      try {
        urls = await tryUpload();
      } catch {
        setCustoms(prev => {
          const updated = prev[productId].slots.map(s =>
            s.id === id ? { ...s, state: 'error' as const } : s
          );
          return { ...prev, [productId]: { ...prev[productId], slots: updated } };
        });
        return;
      }
    }
    setCustoms(prev => {
      const updated = prev[productId].slots.map(s =>
        s.id === id ? { ...s, uploadedUrl: urls[0] ?? '', state: 'done' as const } : s
      );
      return { ...prev, [productId]: { ...prev[productId], slots: updated } };
    });
  }, [sessionId]);

  const handleNoteChange = (productId: number, note: string) => {
    setCustoms(prev => ({ ...prev, [productId]: { ...prev[productId], note } }));
  };

  const isUploading = Object.values(customs).some(c => c.slots.some(s => s.state === 'uploading'));

  const handleSubmit = async () => {
    setBusy(true);
    setErrMsg('');
    try {
      const uploadedCustoms: Record<number, { image_urls: string[]; note: string }> = {};
      for (const it of items) {
        const c = customs[it.product_id];
        const urls = (c?.slots ?? []).filter(s => s.state === 'done').map(s => s.uploadedUrl);
        uploadedCustoms[it.product_id] = { image_urls: urls, note: c?.note ?? '' };
      }

      const apiItems = cartEntriesToApiItems(items, uploadedCustoms);

      const orderResult = await createProductOrder({
        cart_session_id:  sessionId,
        customer_name:    info.name,
        customer_phone:   info.phone,
        customer_email:   info.email || undefined,
        customer_address: info.address,
        items:            apiItems,
      });

      if (orderResult.already_paid) {
        // Order was already paid — clear cart, rotate session, redirect to payment page
        // which will detect paid status and redirect to result.
        if (isBuyNow) localStorage.removeItem('buy_now_checkout');
        else cart.resetSession();
        setErrMsg('Đơn hàng này đã được thanh toán. Đang chuyển hướng...');
        setTimeout(() => navigate(`/checkout/payment/${orderResult.order_id}`), 1500);
        return;
      }

      if (isBuyNow) {
        localStorage.removeItem('buy_now_checkout');
      }
      // Do NOT clear the cart here — user may want to go back and edit before paying.
      // Session is reset on the payment result page after confirmed payment.
      navigate(`/checkout/payment/${orderResult.order_id}`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.';
      setErrMsg(msg);
      setBusy(false);
    }
  };

  return (
    <div className="co-page">
      <SiteHeader />

      <main className="co-main">
        {/* Step indicator */}
        <div className="co-steps">
          <div className={`co-step${step === 1 ? ' co-step--active' : ' co-step--done'}`}>
            <span className="co-step-dot">{step > 1 ? '✓' : '1'}</span>
            <span className="co-step-label">Thông tin</span>
          </div>
          <div className="co-step-line" />
          <div className={`co-step${step === 2 ? ' co-step--active' : ''}`}>
            <span className="co-step-dot">2</span>
            <span className="co-step-label">Ảnh &amp; ghi chú</span>
          </div>
        </div>

        <div className="co-layout">
          {/* ── Left: form ── */}
          <div className="co-form-col">
            {step === 1 && <Step1Form info={info} onChange={setInfo} />}
            {step === 2 && (
              <Step2Form
                items={items}
                customs={customs}
                fileRefs={fileRefs}
                resolveUrl={resolveUrl}
                onFileAdd={handleFileAdd}
                onFileRemove={handleFileRemove}
                onFileRetry={handleFileRetry}
                onNoteChange={handleNoteChange}
              />
            )}

            {errMsg && <p className="co-error">{errMsg}</p>}

            <div className="co-btn-row">
              {step === 2 && (
                <button className="co-back-btn" onClick={() => setStep(1)} disabled={busy}>
                  ← Quay lại
                </button>
              )}
              {step === 1 && (
                <button className="co-next-btn" onClick={handleStep1Submit}>
                  Tiếp theo →
                </button>
              )}
              {step === 2 && (
                <button className="co-pay-btn" onClick={handleSubmit} disabled={busy || isUploading}>
                  {isUploading ? 'Đang tải ảnh...' : busy ? 'Đang xử lý...' : 'Thanh toán ngay'}
                </button>
              )}
            </div>
          </div>

          {/* ── Right: order summary ── */}
          <OrderSummary items={items} subtotal={subtotal} resolveUrl={resolveUrl} />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}


function Step1Form({ info, onChange }: {
  info: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
}) {
  const set = (k: keyof CustomerInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...info, [k]: e.target.value });

  return (
    <div className="co-form">
      <h2 className="co-form-title">Thông tin đặt hàng</h2>

      <label className="co-label">
        Tên người nhận <span className="co-req">*</span>
        <input className="co-input" placeholder="Nguyễn Văn A" value={info.name} onChange={set('name')} />
      </label>

      <label className="co-label">
        Số điện thoại <span className="co-req">*</span>
        <input className="co-input" placeholder="0912 345 678" value={info.phone} onChange={set('phone')} inputMode="tel" />
      </label>

      <label className="co-label">
        Email <span className="co-optional">(không bắt buộc)</span>
        <input className="co-input" placeholder="email@example.com" value={info.email} onChange={set('email')} inputMode="email" />
      </label>

      <label className="co-label">
        Địa chỉ giao hàng <span className="co-req">*</span>
        <span className="co-field-hint">
          <span className="co-field-hint-icon">📍</span>
          <span>
            <strong>Nhập địa chỉ cũ trước sát nhập để tụi mình gửi chính xác hơn nha</strong>
          </span>
        </span>
        <textarea
          className="co-input co-textarea"
          placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
          value={info.address}
          onChange={set('address')}
          rows={3}
        />
      </label>
    </div>
  );
}

function Step2Form({ items, customs, fileRefs, resolveUrl, onFileAdd, onFileRemove, onFileRetry, onNoteChange }: {
  items: CartEntry[];
  customs: Record<number, ItemCustomisation>;
  fileRefs: React.MutableRefObject<Record<number, HTMLInputElement | null>>;
  resolveUrl: (url: string) => string;
  onFileAdd: (id: number, files: FileList | null) => void;
  onFileRemove: (id: number, slotId: string) => void;
  onFileRetry: (id: number, slotId: string) => void;
  onNoteChange: (id: number, note: string) => void;
}) {
  return (
    <div className="co-form">
      <h2 className="co-form-title">Ảnh &amp; ghi chú cho từng sản phẩm</h2>
      <p className="co-form-hint">Tải ảnh (nếu có) và thêm ghi chú cá nhân cho từng sản phẩm.</p>

      {items.map(it => {
        const c = customs[it.product_id] ?? { note: '', slots: [] };
        return (
          <div key={it.product_id} className="co-item-custom">
            {it.thumbnail && (
              <img src={resolveUrl(it.thumbnail)} alt={it.product_name} className="co-item-thumb" />
            )}
            <div className="co-item-custom-body">
              <p className="co-item-custom-name">{it.product_name} × {it.quantity}</p>

              <button
                type="button"
                className="co-upload-btn"
                onClick={() => fileRefs.current[it.product_id]?.click()}
                disabled={c.slots.length >= MAX_PRODUCT_IMAGES}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
                </svg>
                {c.slots.length >= MAX_PRODUCT_IMAGES ? `Đã đủ ${MAX_PRODUCT_IMAGES} ảnh` : 'Thêm ảnh'}
              </button>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                ref={el => { fileRefs.current[it.product_id] = el; }}
                onChange={e => onFileAdd(it.product_id, e.target.files)}
              />

              {c.slots.length > 0 && (
                <div className="co-preview-strip">
                  {c.slots.map(slot => (
                    <div key={slot.id} className={`co-preview-slot${slot.state === 'uploading' ? ' co-preview-slot--uploading' : ''}`}>
                      <img src={slot.previewUrl} alt="" className="co-preview-img" />
                      {slot.state === 'uploading' && (
                        <div className="co-preview-spinner" aria-label="Đang tải">
                          <span className="co-preview-spinner-ring" />
                        </div>
                      )}
                      {slot.state === 'done' && (
                        <div className="co-preview-done" aria-label="Đã tải lên">✓</div>
                      )}
                      {slot.state === 'error' && (
                        <div className="co-preview-error" title="Tải lên thất bại">
                          <button
                            type="button"
                            className="co-preview-retry"
                            onClick={() => onFileRetry(it.product_id, slot.id)}
                            aria-label="Thử lại"
                          >↺</button>
                        </div>
                      )}
                      <button
                        type="button"
                        className="co-preview-remove"
                        onClick={() => onFileRemove(it.product_id, slot.id)}
                        aria-label="Xoá ảnh"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
              {c.slots.some(s => s.state === 'uploading') && (
                <p className="co-upload-status">Đang tải {c.slots.filter(s => s.state === 'uploading').length} ảnh lên...</p>
              )}

              <textarea
                className="co-input co-textarea co-note"
                placeholder="Ghi chú: tên, ngày, màu sắc, yêu cầu đặc biệt..."
                value={c.note}
                onChange={e => onNoteChange(it.product_id, e.target.value)}
                rows={2}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderSummary({ items, subtotal, resolveUrl }: {
  items: CartEntry[];
  subtotal: number;
  resolveUrl: (url: string) => string;
}) {
  return (
    <aside className="co-summary">
      <h3 className="co-summary-title">Đơn hàng</h3>
      <ul className="co-summary-list">
        {items.map(it => (
          <li key={it.product_id} className="co-summary-item">
            {it.thumbnail && (
              <img src={resolveUrl(it.thumbnail)} alt={it.product_name} className="co-summary-img" />
            )}
            <div className="co-summary-item-info">
              <span className="co-summary-item-name">{it.product_name}</span>
              <span className="co-summary-item-qty">× {it.quantity}</span>
            </div>
            <span className="co-summary-item-price">{fmt(it.unit_price * it.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="co-summary-divider" />
      <div className="co-summary-total">
        <span>Tổng cộng</span>
        <strong>{fmt(subtotal)}</strong>
      </div>
      <p className="co-summary-note">Phí vận chuyển sẽ được tính khi giao hàng.</p>
    </aside>
  );
}

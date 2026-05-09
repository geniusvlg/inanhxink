import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { useCart, cartEntriesToApiItems, type CartEntry } from '../contexts/CartContext';
import { createProductOrder, getMetadata, getProductById, uploadProductImages } from '../services/api';
import './CheckoutPage.css';

const DEFAULT_PRODUCT_IMAGE_LIMIT = 15;
const SHIPPING_THRESHOLD_KEY = 'product_shipping_fee_threshold';
const SHIPPING_BELOW_THRESHOLD_FEE_KEY = 'product_shipping_fee_below_threshold';
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

function imageLimitFor(item?: Pick<CartEntry, 'max_upload_images'>): number {
  const limit = item?.max_upload_images ?? DEFAULT_PRODUCT_IMAGE_LIMIT;
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_PRODUCT_IMAGE_LIMIT;
}

function moneyConfigValue(config: Record<string, string>, key: string): number {
  const value = Number((config[key] ?? '0').replace(/,/g, ''));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function shippingFeeForSubtotal(subtotal: number, config: Record<string, string>): number {
  const threshold = moneyConfigValue(config, SHIPPING_THRESHOLD_KEY);
  const fee = moneyConfigValue(config, SHIPPING_BELOW_THRESHOLD_FEE_KEY);
  return threshold > 0 && fee > 0 && subtotal < threshold ? fee : 0;
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
  const [shippingConfig, setShippingConfig] = useState<Record<string, string>>({});
  const shippingFee = shippingFeeForSubtotal(subtotal, shippingConfig);
  const total = subtotal + shippingFee;
  const [productImageLimits, setProductImageLimits] = useState<Record<number, number>>({});

  const [step,    setStep]    = useState<1 | 2>(1);
  const [busy,    setBusy]    = useState(false);
  const [errMsg,  setErrMsg]  = useState('');

  const [info, setInfo] = useState<CustomerInfo>({ name: '', phone: '', email: '', address: '' });

  // customs keyed by composite key: `${product_id}` or `${product_id}|v${variant_id}`
  const itemKey = (it: CartEntry) =>
    it.variant_id != null ? `${it.product_id}|v${it.variant_id}` : `${it.product_id}`;

  const [customs, setCustoms] = useState<Record<string, ItemCustomisation>>(() =>
    Object.fromEntries(items.map(it => [itemKey(it), { note: '', slots: [] }]))
  );
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    const loadLimits = async () => {
      const entries = await Promise.all(items.map(async it => {
        try {
          const product = await getProductById(it.product_id);
          return [it.product_id, imageLimitFor(product)] as const;
        } catch {
          return [it.product_id, imageLimitFor(it)] as const;
        }
      }));
      if (!cancelled) {
        setProductImageLimits(Object.fromEntries(entries.map(([id, limit]) => [id, limit])));
      }
    };
    loadLimits();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    getMetadata()
      .then(config => {
        if (!cancelled) setShippingConfig(config);
      })
      .catch(() => {
        if (!cancelled) setShippingConfig({});
      });
    return () => { cancelled = true; };
  }, []);

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

  const handleFileAdd = useCallback(async (key: string, productId: number, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const limit = productImageLimits[productId] ?? imageLimitFor(items.find(it => it.product_id === productId));
    const existingCount = customs[key]?.slots.length ?? 0;
    const remaining = limit - existingCount;
    if (remaining <= 0) {
      alert(`Sản phẩm này chỉ được upload tối đa ${limit} ảnh.`);
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
      [key]: { ...prev[key], slots: [...(prev[key]?.slots ?? []), ...newSlots] },
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
          const updated = (prev[key]?.slots ?? []).map(s =>
            newSlots.some(ns => ns.id === s.id) ? { ...s, state: 'error' as const } : s
          );
          return { ...prev, [key]: { ...prev[key], slots: updated } };
        });
        if (fileRefs.current[key]) fileRefs.current[key]!.value = '';
        return;
      }
    }
    setCustoms(prev => {
      const updated = (prev[key]?.slots ?? []).map(s => {
        const idx = newSlots.findIndex(ns => ns.id === s.id);
        if (idx === -1) return s;
        return { ...s, uploadedUrl: urls[idx] ?? '', state: 'done' as const };
      });
      return { ...prev, [key]: { ...prev[key], slots: updated } };
    });
    if (fileRefs.current[key]) fileRefs.current[key]!.value = '';
  }, [customs, items, productImageLimits, sessionId]);

  const handleFileRemove = useCallback((key: string, id: string) => {
    setCustoms(prev => {
      const slot = prev[key]?.slots.find(s => s.id === id);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      return {
        ...prev,
        [key]: { ...prev[key], slots: (prev[key]?.slots ?? []).filter(s => s.id !== id) },
      };
    });
  }, []);

  const handleFileRetry = useCallback(async (key: string, id: string) => {
    let fileToRetry: File | null = null;
    setCustoms(prev => {
      const slot = prev[key]?.slots.find(s => s.id === id);
      if (!slot) return prev;
      fileToRetry = slot.file;
      const updated = (prev[key]?.slots ?? []).map(s =>
        s.id === id ? { ...s, state: 'uploading' as const } : s
      );
      return { ...prev, [key]: { ...prev[key], slots: updated } };
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
          const updated = (prev[key]?.slots ?? []).map(s =>
            s.id === id ? { ...s, state: 'error' as const } : s
          );
          return { ...prev, [key]: { ...prev[key], slots: updated } };
        });
        return;
      }
    }
    setCustoms(prev => {
      const updated = (prev[key]?.slots ?? []).map(s =>
        s.id === id ? { ...s, uploadedUrl: urls[0] ?? '', state: 'done' as const } : s
      );
      return { ...prev, [key]: { ...prev[key], slots: updated } };
    });
  }, [sessionId]);

  const handleNoteChange = (key: string, note: string) => {
    setCustoms(prev => ({ ...prev, [key]: { ...prev[key], note } }));
  };

  const isUploading = Object.values(customs).some(c => c.slots.some(s => s.state === 'uploading'));

  const handleSubmit = async () => {
    setBusy(true);
    setErrMsg('');
    try {
      const uploadedCustoms: Record<string, { image_urls: string[]; note: string }> = {};
      for (const it of items) {
        const key = itemKey(it);
        const c = customs[key];
        const urls = (c?.slots ?? []).filter(s => s.state === 'done').map(s => s.uploadedUrl);
        uploadedCustoms[key] = { image_urls: urls, note: c?.note ?? '' };
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
            <span className="co-step-label">Ghi chú</span>
          </div>
        </div>

        <div className="co-layout">
          {/* ── Left: form ── */}
          <div className="co-form-col">
            {step === 1 && <Step1Form info={info} onChange={setInfo} />}
            {step === 2 && (
              <Step2Form
                items={items}
                productImageLimits={productImageLimits}
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
          <OrderSummary items={items} subtotal={subtotal} shippingFee={shippingFee} total={total} resolveUrl={resolveUrl} />
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

function Step2Form({ items, productImageLimits, customs, fileRefs, resolveUrl, onFileAdd, onFileRemove, onFileRetry, onNoteChange }: {
  items: CartEntry[];
  productImageLimits: Record<number, number>;
  customs: Record<string, ItemCustomisation>;
  fileRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  resolveUrl: (url: string) => string;
  onFileAdd: (key: string, productId: number, files: FileList | null) => void;
  onFileRemove: (key: string, slotId: string) => void;
  onFileRetry: (key: string, slotId: string) => void;
  onNoteChange: (key: string, note: string) => void;
}) {
  return (
    <div className="co-form">
      <h2 className="co-form-title">Ghi chú cho từng sản phẩm</h2>
      <p className="co-form-hint">Thêm ghi chú cá nhân. Ảnh sản phẩm vui lòng gửi qua Zalo sau khi đặt hàng.</p>

      {items.map(it => {
        const key = it.variant_id != null ? `${it.product_id}|v${it.variant_id}` : `${it.product_id}`;
        const c = customs[key] ?? { note: '', slots: [] };
        const limit = productImageLimits[it.product_id] ?? imageLimitFor(it);
        return (
          <div key={key} className="co-item-custom">
            {it.thumbnail && (
              <img src={resolveUrl(it.thumbnail)} alt={it.product_name} className="co-item-thumb" />
            )}
            <div className="co-item-custom-body">
              <div className="co-item-custom-title">
                <p className="co-item-custom-name">
                  {it.product_name}
                  {it.variant_name && (
                    <span style={{ fontSize: '0.85em', color: '#64748b', marginLeft: '0.4em', fontWeight: 400 }}>
                      — {it.variant_name}
                    </span>
                  )}
                </p>
                <p className="co-item-custom-qty">Số lượng: {it.quantity}</p>
              </div>

              <div className="co-zalo-notice">
                <span className="co-zalo-notice-icon">📸</span>
                <div className="co-zalo-notice-text">
                  <strong>Gửi ảnh qua Zalo sau khi đặt hàng.</strong>
                  <span> Tối đa {limit} ảnh — nhắn kèm <em>mã đơn hàng</em> để shop xử lý đúng đơn.</span>
                </div>
              </div>

              <textarea
                className="co-input co-textarea co-note"
                placeholder="Ghi chú: tên, ngày, màu sắc, yêu cầu đặc biệt..."
                value={c.note}
                onChange={e => onNoteChange(key, e.target.value)}
                rows={2}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrderSummary({ items, subtotal, shippingFee, total, resolveUrl }: {
  items: CartEntry[];
  subtotal: number;
  shippingFee: number;
  total: number;
  resolveUrl: (url: string) => string;
}) {
  return (
    <aside className="co-summary">
      <h3 className="co-summary-title">Đơn hàng</h3>
      <ul className="co-summary-list">
        {items.map(it => {
          const key = it.variant_id != null ? `${it.product_id}|v${it.variant_id}` : `${it.product_id}`;
          return (
          <li key={key} className="co-summary-item">
            {it.thumbnail && (
              <img src={resolveUrl(it.thumbnail)} alt={it.product_name} className="co-summary-img" />
            )}
            <div className="co-summary-item-info">
              <span className="co-summary-item-name">
                {it.product_name}
                {it.variant_name && (
                  <span style={{ display: 'block', fontSize: '0.8em', color: '#64748b', fontWeight: 400 }}>
                    {it.variant_name}
                  </span>
                )}
              </span>
              <span className="co-summary-item-qty">× {it.quantity}</span>
            </div>
            <span className="co-summary-item-price">{fmt(it.unit_price * it.quantity)}</span>
          </li>
          );
        })}
      </ul>
      <div className="co-summary-divider" />
      <div className="co-summary-row">
        <span>Tạm tính</span>
        <strong>{fmt(subtotal)}</strong>
      </div>
      <div className="co-summary-row">
        <span>Phí ship</span>
        <strong>{fmt(shippingFee)}</strong>
      </div>
      <div className="co-summary-total">
        <span>Tổng cộng</span>
        <strong>{fmt(total)}</strong>
      </div>
    </aside>
  );
}

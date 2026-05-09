import { useCallback, useEffect, useRef, useState } from 'react';
import { productOrdersApi } from '../services/api';
import { resolveAssetUrl } from '../utils/assetUrl';
import './FulfillmentPage.css';

type FulfillmentStatus = 'new' | 'preparing' | 'packing' | 'shipped';
type OrderType = 'product' | 'qr_keychain';

interface FulfillmentOrder {
  order_type: OrderType;
  id: number;
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items_json: string;
  total_amount: number;
  fulfillment_stage: string;
  tracking_code: string;
  shipping_carrier: string;
  created_at: string;
}

interface OrderItem {
  product_id?: number;
  product_name: string;
  variant_id?: number | null;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  /** Product / Phân loại preview (first gallery or variant image). */
  catalog_image?: string | null;
  image_urls?: string[];
  note?: string;
}

function parseItems(raw: string | OrderItem[] | undefined): OrderItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw) ?? []; } catch { return []; }
}

const COLUMNS: { key: FulfillmentStatus; label: string; icon: string; next?: FulfillmentStatus; nextLabel?: string }[] = [
  { key: 'new',       label: 'Chờ xử lý',         icon: '🕐', next: 'preparing', nextLabel: 'Bắt đầu chuẩn bị' },
  { key: 'preparing', label: 'Đang chuẩn bị',      icon: '🛠️', next: 'packing',   nextLabel: 'Chuyển sang đóng gói' },
  { key: 'packing',   label: 'Đóng gói',            icon: '📦', next: 'shipped',   nextLabel: 'Giao vận chuyển' },
  { key: 'shipped',   label: 'Đã giao vận chuyển', icon: '🚚' },
];

const STATUS_TO_API: Record<FulfillmentStatus, string | undefined> = {
  new: undefined, preparing: 'preparing', packing: 'packing', shipped: 'shipped',
};

function formatMoney(v: number) {
  return new Intl.NumberFormat('vi-VN').format(v) + '₫';
}

// ── Order Detail / Edit Modal ────────────────────────────────────────────────

interface SearchResult {
  type: 'product' | 'qr';
  order: {
    id?: number;
    invoice_number: string;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string;
    total_amount?: number;
    payment_status?: string;
    fulfillment_status?: string;
    fulfillment_label?: string;
    tracking_code?: string;
    shipping_carrier?: string;
    items?: string | OrderItem[];
  };
}

function OrderDetailModal({
  result,
  onClose,
  onSaved,
}: {
  result: SearchResult;
  onClose: () => void;
  onSaved: () => void;
}) {
  const order = result.order;
  const isProduct = result.type === 'product';
  const rawItems = order.items ?? '[]';
  const [items, setItems] = useState<OrderItem[]>(() => parseItems(rawItems));
  const [editPhone, setEditPhone] = useState(order.customer_phone ?? '');
  const [editAddress, setEditAddress] = useState(order.customer_address ?? '');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const stageLabel: Record<string, string> = {
    new: 'Chờ xử lý', preparing: 'Đang chuẩn bị',
    packing: 'Đóng gói', shipped: 'Đã giao vận chuyển',
    pending: 'Chờ xử lý',
  };

  const handleNoteChange = (idx: number, note: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, note } : it));
  };

  const handleRemoveImage = (itemIdx: number, imgIdx: number) => {
    setItems(prev => prev.map((it, i) => i !== itemIdx ? it : {
      ...it,
      image_urls: (it.image_urls ?? []).filter((_, j) => j !== imgIdx),
    }));
  };

  const handleSave = async () => {
    if (!isProduct || !order.id) return;
    setShowSaveConfirm(false);
    setSaving(true);
    setSaveMsg('');
    try {
      await productOrdersApi.updateProductOrderItems(order.id!, items, {
        phone:   editPhone   !== order.customer_phone   ? editPhone   : undefined,
        address: editAddress !== order.customer_address ? editAddress : undefined,
      });
      setSaveMsg('✓ Đã lưu');
      onSaved();
    } catch {
      setSaveMsg('Lỗi khi lưu. Thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadAll = async (itemIdx: number) => {
    const urls = items[itemIdx]?.image_urls ?? [];
    if (!urls.length) return;

    const baseName = (idx: number, ext: string) =>
      `${order.invoice_number}-item${itemIdx + 1}-${idx + 1}.${ext}`;

    // Prefer the File System Access API (Chrome/Edge) — lets user pick a folder.
    if ('showDirectoryPicker' in window) {
      let dirHandle: FileSystemDirectoryHandle;
      try {
        dirHandle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      } catch {
        return; // user cancelled
      }
      for (let j = 0; j < urls.length; j++) {
        try {
          const res = await fetch(resolveAssetUrl(urls[j]));
          const blob = await res.blob();
          const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
          const fileHandle = await dirHandle.getFileHandle(baseName(j, ext), { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch {
          // skip failed files silently
        }
      }
      return;
    }

    // Fallback: sequential browser downloads (respects browser "ask where to save" setting).
    for (let j = 0; j < urls.length; j++) {
      try {
        const res = await fetch(resolveAssetUrl(urls[j]));
        const blob = await res.blob();
        const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = baseName(j, ext);
        a.click();
        URL.revokeObjectURL(a.href);
        await new Promise(r => setTimeout(r, 200));
      } catch {
        // skip failed downloads silently
      }
    }
  };

  return (
    <div className="ff-modal-overlay" onClick={onClose}>
      <div className="ff-modal" onClick={e => e.stopPropagation()}>
        <div className="ff-modal-header">
          <div>
            <div className="ff-modal-invoice">{order.invoice_number}</div>
            <div className="ff-modal-customer">
              <span className="ff-card-label">Tên khách hàng:</span> {order.customer_name}
            </div>
          </div>
          <button className="ff-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ff-modal-meta">
          {order.customer_phone !== undefined && (
            <span className="ff-modal-meta-phone">
              📞
              {isProduct
                ? <input className="ff-modal-meta-input ff-modal-meta-input--phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="SĐT" />
                : order.customer_phone}
            </span>
          )}
          {order.customer_address !== undefined && (
            <span className="ff-modal-meta-address">
              📍
              {isProduct
                ? <input className="ff-modal-meta-input" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Địa chỉ" />
                : order.customer_address}
            </span>
          )}
          {order.total_amount && <span>💰 {formatMoney(Number(order.total_amount))}</span>}
          <span className={`ff-modal-payment ff-modal-payment--${order.payment_status ?? 'pending'}`}>
            {order.payment_status === 'paid' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
          </span>
          {order.fulfillment_status && order.payment_status === 'paid' && (
            <span className={`ff-modal-stage ff-modal-stage--${order.fulfillment_status}`}>
              {stageLabel[order.fulfillment_status] ?? order.fulfillment_status}
            </span>
          )}
          {order.shipping_carrier && <span>🚚 {order.shipping_carrier}</span>}
          {order.tracking_code && <span>📦 {order.tracking_code}</span>}
        </div>

        <div className="ff-modal-items">
          {isProduct ? items.map((item, i) => (
            <div key={`${item.product_id ?? i}-${item.variant_id ?? 'base'}-${i}`} className="ff-modal-item">
              <div className="ff-modal-item-header">
                <div>
                  <strong>{item.product_name}</strong>
                  {item.variant_name?.trim() && (
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem', fontWeight: 400 }}>
                      Phân loại: <strong style={{ color: '#334155' }}>{item.variant_name}</strong>
                    </div>
                  )}
                </div>
                <div className="ff-modal-item-header-right">
                  {(item.image_urls?.length ?? 0) > 0 && (
                    <button
                      className="ff-modal-download-btn"
                      onClick={() => handleDownloadAll(i)}
                      title="Tải tất cả ảnh"
                    >
                      ⬇ Tải {item.image_urls!.length} ảnh
                    </button>
                  )}
                  <span>SL: {item.quantity} × {formatMoney(item.unit_price)}</span>
                </div>
              </div>

              {/* Image grid: catalog (web) preview + customer uploads */}
              <div className="ff-modal-images">
                {item.catalog_image?.trim() && (
                  <div className="ff-modal-img-wrap ff-modal-img-wrap--catalog" title="Ảnh SP / Phân loại (như trên web)">
                    <a href={resolveAssetUrl(item.catalog_image)} target="_blank" rel="noreferrer">
                      <img src={resolveAssetUrl(item.catalog_image)} alt="" className="ff-modal-img" />
                    </a>
                  </div>
                )}
                {(item.image_urls ?? []).map((url, j) => (
                  <div key={j} className="ff-modal-img-wrap">
                    <a href={resolveAssetUrl(url)} target="_blank" rel="noreferrer">
                      <img src={resolveAssetUrl(url)} alt={`Ảnh ${j + 1}`} className="ff-modal-img" />
                    </a>
                    <button
                      className="ff-modal-img-remove"
                      onClick={() => handleRemoveImage(i, j)}
                      title="Xoá ảnh"
                    >✕</button>
                  </div>
                ))}
              </div>

              <div className="ff-modal-note-row">
                <div className="ff-modal-note-header">
                  <label className="ff-modal-note-label">Ghi chú khách:</label>
                  {item.note && (
                    <button
                      className="ff-modal-copy-btn"
                      onClick={() => navigator.clipboard.writeText(item.note ?? '').then(() => {
                        const btn = document.activeElement as HTMLButtonElement;
                        const orig = btn.textContent;
                        btn.textContent = '✓ Đã sao chép';
                        setTimeout(() => { btn.textContent = orig; }, 1500);
                      })}
                    >
                      📋 Sao chép
                    </button>
                  )}
                </div>
                <textarea
                  className="ff-modal-note"
                  value={item.note ?? ''}
                  onChange={e => handleNoteChange(i, e.target.value)}
                  rows={6}
                  placeholder="Thêm ghi chú..."
                />
              </div>
            </div>
          )) : (
            <div className="ff-modal-qr-note">
              <p>Đây là đơn QR. Dữ liệu template được lưu trong hệ thống.</p>
            </div>
          )}
        </div>

        {isProduct && (
          <div className="ff-modal-footer">
            {saveMsg && <span className="ff-modal-save-msg">{saveMsg}</span>}
            <button className="ff-modal-save-btn" onClick={() => setShowSaveConfirm(true)} disabled={saving}>
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </div>
        )}

        {showSaveConfirm && (
          <div className="ff-save-confirm-overlay" onClick={() => setShowSaveConfirm(false)}>
            <div className="ff-save-confirm" onClick={e => e.stopPropagation()}>
              <div className="ff-save-confirm-icon">💾</div>
              <div className="ff-save-confirm-title">Xác nhận lưu thay đổi?</div>
              <div className="ff-save-confirm-text">
                Thông tin đơn hàng, ảnh và ghi chú khách sẽ được cập nhật.
              </div>
              <div className="ff-save-confirm-actions">
                <button className="ff-save-confirm-cancel" onClick={() => setShowSaveConfirm(false)}>
                  Huỷ
                </button>
                <button className="ff-save-confirm-ok" onClick={handleSave} disabled={saving}>
                  {saving ? 'Đang lưu...' : '✓ Xác nhận lưu'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order Card ───────────────────────────────────────────────────────────────

function OrderCard({
  order, next, nextLabel, onAdvance, onViewDetail,
}: {
  order: FulfillmentOrder;
  next?: FulfillmentStatus;
  nextLabel?: string;
  onAdvance: (id: number, type: OrderType, status: FulfillmentStatus, trackingCode?: string, shippingCarrier?: string) => void;
  onViewDetail: (order: FulfillmentOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [shippingCarrier, setShippingCarrier] = useState('');
  const items = parseItems(order.items_json);
  const firstImg =
    items[0]?.catalog_image?.trim()
    || items[0]?.image_urls?.[0];
  const isKeychain = order.order_type === 'qr_keychain';

  const handleAdvanceClick = () => {
    if (next === 'shipped') setShowTracking(true);
    else if (next) setShowConfirm(true);
  };
  const handleConfirm = () => {
    if (next) onAdvance(order.id, order.order_type, next);
    setShowConfirm(false);
  };
  const handleConfirmShipped = () => {
    if (!trackingCode.trim() || !shippingCarrier.trim()) return;
    if (next) onAdvance(order.id, order.order_type, next, trackingCode.trim(), shippingCarrier.trim());
    setShowTracking(false);
    setTrackingCode('');
    setShippingCarrier('');
  };

  return (
    <div className={`ff-card${isKeychain ? ' ff-card--keychain' : ''}`}>
      <div className="ff-card-header" onClick={() => setOpen(o => !o)}>
        <div className="ff-card-title">
          {firstImg && <img src={resolveAssetUrl(firstImg)} alt="" className="ff-card-thumb" />}
          {isKeychain && !firstImg && <span className="ff-keychain-icon">🔗</span>}
          <div>
            <div className="ff-card-invoice">
              {isKeychain ? '🔳 ' : ''}{order.reference}
            </div>
            <div className="ff-card-customer">
              <span className="ff-card-label">Tên khách hàng:</span> {order.customer_name}
            </div>
            <div className="ff-card-date">
              {new Date(order.created_at).toLocaleDateString('vi-VN')}
              {' '}
              {new Date(order.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="ff-card-amount">{formatMoney(Number(order.total_amount))}</div>
      </div>

      {open && (
        <div className="ff-card-detail">
          {order.customer_phone && (
            <div className="ff-detail-row"><span>SĐT:</span><span>{order.customer_phone}</span></div>
          )}
          {order.customer_address && (
            <div className="ff-detail-row"><span>Địa chỉ:</span><span>{order.customer_address}</span></div>
          )}
          {order.tracking_code && (
            <div className="ff-detail-row"><span>Mã vận đơn:</span><span>{order.tracking_code}</span></div>
          )}
          {order.shipping_carrier && (
            <div className="ff-detail-row"><span>Đơn vị vận chuyển:</span><span>{order.shipping_carrier}</span></div>
          )}
          <div className="ff-items">
            {items.map((item, i) => {
              const rowThumb = item.catalog_image?.trim() || item.image_urls?.[0];
              return (
              <div key={`${item.product_id ?? i}-${item.variant_id ?? 'base'}-${i}`} className="ff-item-row">
                {rowThumb && (
                  <img src={resolveAssetUrl(rowThumb)} alt="" className="ff-item-thumb" />
                )}
                <div className="ff-item-info">
                  <div className="ff-item-name"><span className="ff-card-label">SP:</span> {item.product_name}</div>
                  {item.variant_name?.trim() && (
                    <div className="ff-item-variant">Phân loại: {item.variant_name}</div>
                  )}
                  <div className="ff-item-qty">SL: {item.quantity} × {formatMoney(item.unit_price)}</div>
                  {item.note && <div className="ff-item-note">📝 {item.note}</div>}
                </div>
              </div>
              );
            })}
          </div>
          <button className="ff-view-detail-btn" onClick={() => onViewDetail(order)}>
            🔍 Xem & chỉnh sửa chi tiết
          </button>
        </div>
      )}

      {next && nextLabel && !showTracking && !showConfirm && (
        <button className="ff-advance-btn" onClick={handleAdvanceClick}>{nextLabel} →</button>
      )}
      {showConfirm && (
        <div className="ff-confirm">
          <div className="ff-confirm-text">
            Chuyển <strong>{order.reference}</strong> sang<br />
            <strong>"{COLUMNS.find(c => c.next === next)?.nextLabel ?? nextLabel}"</strong>?
          </div>
          <div className="ff-tracking-actions">
            <button className="ff-tracking-cancel" onClick={() => setShowConfirm(false)}>Huỷ</button>
            <button className="ff-tracking-confirm" onClick={handleConfirm}>✓ Xác nhận</button>
          </div>
        </div>
      )}
      {showTracking && (
        <div className="ff-tracking-input">
          <label className="ff-tracking-label">Đơn vị vận chuyển (bắt buộc)</label>
          <input
            className="ff-tracking-field"
            type="text"
            placeholder="Ví dụ: GHN, Viettel Post, SPX..."
            value={shippingCarrier}
            onChange={e => setShippingCarrier(e.target.value)}
            autoFocus
          />
          <label className="ff-tracking-label">Mã vận đơn (bắt buộc)</label>
          <input
            className="ff-tracking-field"
            type="text"
            placeholder="Nhập mã vận đơn..."
            value={trackingCode}
            onChange={e => setTrackingCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && trackingCode.trim() && shippingCarrier.trim() && handleConfirmShipped()}
          />
          <div className="ff-tracking-actions">
            <button className="ff-tracking-cancel" onClick={() => { setShowTracking(false); setTrackingCode(''); setShippingCarrier(''); }}>Huỷ</button>
            <button className="ff-tracking-confirm" onClick={handleConfirmShipped} disabled={!trackingCode.trim() || !shippingCarrier.trim()}>
              🚚 Xác nhận giao
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function FulfillmentPage() {
  const SHIPPED_PAGE_SIZE = 30;

  const [columns, setColumns] = useState<Record<FulfillmentStatus, FulfillmentOrder[]>>({
    new: [], preparing: [], packing: [], shipped: [],
  });
  const [loading, setLoading] = useState(true);
  const [shippedHasMore, setShippedHasMore] = useState(false);
  const [shippedLoadingMore, setShippedLoadingMore] = useState(false);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [detailOrder, setDetailOrder] = useState<{ result: SearchResult } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [newRes, preparingRes, packingRes, shippedRes] = await Promise.all([
        productOrdersApi.listFulfillment(),
        productOrdersApi.listFulfillment('preparing'),
        productOrdersApi.listFulfillment('packing'),
        productOrdersApi.listFulfillment('shipped', SHIPPED_PAGE_SIZE, 0),
      ]);
      setColumns({
        new:       newRes.data.orders ?? [],
        preparing: preparingRes.data.orders ?? [],
        packing:   packingRes.data.orders ?? [],
        shipped:   shippedRes.data.orders ?? [],
      });
      setShippedHasMore(shippedRes.data.has_more ?? false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreShipped = async () => {
    setShippedLoadingMore(true);
    try {
      const res = await productOrdersApi.listFulfillment(
        'shipped', SHIPPED_PAGE_SIZE, columns.shipped.length,
      );
      setColumns(prev => ({ ...prev, shipped: [...prev.shipped, ...(res.data.orders ?? [])] }));
      setShippedHasMore(res.data.has_more ?? false);
    } catch (err) {
      console.error(err);
    } finally {
      setShippedLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const clearSearch = () => {
    setSearchInvoice('');
    setSearchName('');
    setSearchPhone('');
    setSearchError('');
    setSearchResults([]);
  };

  const handleSearch = async () => {
    const params = {
      ...(searchInvoice.trim() ? { invoice: searchInvoice.trim() } : {}),
      ...(searchName.trim()    ? { name:    searchName.trim()    } : {}),
      ...(searchPhone.trim()   ? { phone:   searchPhone.trim()   } : {}),
    };
    if (Object.keys(params).length === 0) return;
    setSearching(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const res = await productOrdersApi.searchOrder(params);
      setSearchResults(res.data.results ?? []);
    } catch {
      setSearchError('Không tìm thấy đơn hàng phù hợp.');
    } finally {
      setSearching(false);
    }
  };

  const handleAdvance = async (id: number, type: OrderType, nextStatus: FulfillmentStatus, trackingCode?: string, shippingCarrier?: string) => {
    const apiStatus = STATUS_TO_API[nextStatus];
    if (!apiStatus) return;
    try {
      if (type === 'qr_keychain') {
        await productOrdersApi.updateQRKeychainFulfillment(id, apiStatus, trackingCode, shippingCarrier);
      } else {
        await productOrdersApi.updateFulfillment(id, apiStatus, trackingCode, shippingCarrier);
      }
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const openDetailFromCard = (order: FulfillmentOrder) => {
    const items = parseItems(order.items_json);
    setDetailOrder({
      result: {
        type: order.order_type === 'qr_keychain' ? 'qr' : 'product',
        order: {
          id: order.id,
          invoice_number: order.reference,
          customer_name: order.customer_name,
          customer_phone: order.customer_phone,
          customer_address: order.customer_address,
          total_amount: order.total_amount,
          payment_status: 'paid',
          fulfillment_status: order.fulfillment_stage,
          tracking_code: order.tracking_code,
          shipping_carrier: order.shipping_carrier,
          items: JSON.stringify(items),
        },
      },
    });
  };

  return (
    <div className="ff-page">
      {/* Header */}
      <div className="ff-page-header">
        <h1 className="admin-page-title">⚙️ Xử lý đơn hàng</h1>
        <button className="ff-refresh-btn" onClick={load} disabled={loading}>
          {loading ? 'Đang tải...' : '🔄 Làm mới'}
        </button>
      </div>

      {/* Search bar */}
      <div className="ff-search-panel">
        <div className="ff-search-fields">
          <div className="ff-search-field">
            <label className="ff-search-label">Mã đơn hàng</label>
            <input
              ref={searchRef}
              className="ff-search-input"
              type="text"
              placeholder="INXK29..."
              value={searchInvoice}
              onChange={e => { setSearchInvoice(e.target.value); setSearchError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="ff-search-field">
            <label className="ff-search-label">Tên khách hàng</label>
            <input
              className="ff-search-input"
              type="text"
              placeholder="Nguyễn Văn A..."
              value={searchName}
              onChange={e => { setSearchName(e.target.value); setSearchError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="ff-search-field">
            <label className="ff-search-label">Số điện thoại</label>
            <input
              className="ff-search-input"
              type="text"
              placeholder="09..."
              value={searchPhone}
              onChange={e => { setSearchPhone(e.target.value); setSearchError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>
        <div className="ff-search-actions">
          <button
            className="ff-search-btn"
            onClick={handleSearch}
            disabled={searching || (!searchInvoice.trim() && !searchName.trim() && !searchPhone.trim())}
          >
            {searching ? '...' : '🔍 Tìm'}
          </button>
          {(searchInvoice || searchName || searchPhone || searchResults.length > 0) && (
            <button className="ff-search-clear-btn" onClick={clearSearch}>✕ Xóa</button>
          )}
        </div>
      </div>

      {searchError && <div className="ff-search-error">{searchError}</div>}

      {searchResults.length > 0 && (
        <div className="ff-search-results">
          <div className="ff-results-table">
            <div className="ff-results-head">
              <span>Mã đơn</span>
              <span>Khách hàng</span>
              <span>Tổng tiền</span>
              <span>Trạng thái</span>
              <span>Vận chuyển</span>
              <span></span>
            </div>
            {searchResults.map((result, idx) => (
              <div key={idx} className={`ff-results-row ff-results-row--${result.order.fulfillment_status ?? 'new'}`}>
                <span className="ff-results-invoice">{result.order.invoice_number}</span>
                <span className="ff-results-customer">
                  <span className="ff-results-name">{result.order.customer_name}</span>
                  {result.order.customer_phone && (
                    <span className="ff-results-phone">{result.order.customer_phone}</span>
                  )}
                </span>
                <span className="ff-results-amount">{formatMoney(Number(result.order.total_amount))}</span>
                <span>
                  <span className={`ff-modal-stage ff-modal-stage--${result.order.fulfillment_status ?? 'new'}`}>
                    {result.order.fulfillment_label ?? 'Chờ xử lý'}
                  </span>
                </span>
                <span className="ff-results-tracking">
                  {result.order.shipping_carrier && <span>🚚 {result.order.shipping_carrier}</span>}
                  {result.order.tracking_code && <span>📦 {result.order.tracking_code}</span>}
                </span>
                <span>
                  <button
                    className="ff-search-open-btn"
                    onClick={() => setDetailOrder({ result })}
                  >
                    Xem & sửa →
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div className="ff-board">
        {COLUMNS.map(col => {
          const orders = columns[col.key];
          const isShipped = col.key === 'shipped';
          return (
            <div key={col.key} className={`ff-column ff-column--${col.key}`}>
              <div className="ff-column-header">
                <span>{col.icon} {col.label}</span>
                <span className="ff-column-count">{orders.length}{isShipped && shippedHasMore ? '+' : ''}</span>
              </div>
              <div className="ff-column-body">
                {orders.length === 0 && <div className="ff-empty">Không có đơn nào</div>}
                {orders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    next={col.next}
                    nextLabel={col.nextLabel}
                    onAdvance={handleAdvance}
                    onViewDetail={openDetailFromCard}
                  />
                ))}
                {isShipped && shippedHasMore && (
                  <button
                    className="ff-load-more-btn"
                    onClick={loadMoreShipped}
                    disabled={shippedLoadingMore}
                  >
                    {shippedLoadingMore ? 'Đang tải...' : `Xem thêm`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail / Edit modal */}
      {detailOrder && (
        <OrderDetailModal
          result={detailOrder.result}
          onClose={() => setDetailOrder(null)}
          onSaved={() => { load(); setDetailOrder(null); }}
        />
      )}
    </div>
  );
}

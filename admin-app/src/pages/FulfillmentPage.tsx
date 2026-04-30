import { useCallback, useEffect, useRef, useState } from 'react';
import { productOrdersApi, uploadApi } from '../services/api';
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
  created_at: string;
}

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
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
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetIdx = useRef<number>(-1);

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

  const handleAddImagesClick = (itemIdx: number) => {
    uploadTargetIdx.current = itemIdx;
    fileInputRef.current?.click();
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const itemIdx = uploadTargetIdx.current;
    setUploadingIdx(itemIdx);
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const res = await uploadApi.images(files, 'product-orders/admin');
      const newUrls: string[] = res.data.urls ?? [];
      setItems(prev => prev.map((it, i) => i !== itemIdx ? it : {
        ...it,
        image_urls: [...(it.image_urls ?? []), ...newUrls],
      }));
      setSaveMsg('');
    } catch {
      setSaveMsg('Upload ảnh thất bại. Thử lại.');
    } finally {
      setUploadingIdx(null);
    }
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFilesChosen}
        />

        <div className="ff-modal-header">
          <div>
            <div className="ff-modal-invoice">{order.invoice_number}</div>
            <div className="ff-modal-customer">{order.customer_name}</div>
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
          {order.tracking_code && <span>🚚 {order.tracking_code}</span>}
        </div>

        <div className="ff-modal-items">
          {isProduct ? items.map((item, i) => (
            <div key={i} className="ff-modal-item">
              <div className="ff-modal-item-header">
                <strong>{item.product_name}</strong>
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

              {/* Image grid with remove buttons */}
              <div className="ff-modal-images">
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
                {/* Add images slot */}
                <button
                  className="ff-modal-img-add"
                  onClick={() => handleAddImagesClick(i)}
                  disabled={uploadingIdx === i}
                >
                  {uploadingIdx === i ? (
                    <span className="ff-modal-uploading">⏳</span>
                  ) : (
                    <>
                      <span className="ff-modal-add-icon">+</span>
                      <span className="ff-modal-add-label">Thêm ảnh</span>
                    </>
                  )}
                </button>
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
  onAdvance: (id: number, type: OrderType, status: FulfillmentStatus, trackingCode?: string) => void;
  onViewDetail: (order: FulfillmentOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const items = parseItems(order.items_json);
  const firstImg = items[0]?.image_urls?.[0];
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
    if (!trackingCode.trim()) return;
    if (next) onAdvance(order.id, order.order_type, next, trackingCode.trim());
    setShowTracking(false);
    setTrackingCode('');
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
          <div className="ff-items">
            {items.map((item, i) => (
              <div key={i} className="ff-item-row">
                {item.image_urls?.[0] && (
                  <img src={resolveAssetUrl(item.image_urls[0])} alt="" className="ff-item-thumb" />
                )}
                <div className="ff-item-info">
                  <div className="ff-item-name"><span className="ff-card-label">SP:</span> {item.product_name}</div>
                  <div className="ff-item-qty">SL: {item.quantity} × {formatMoney(item.unit_price)}</div>
                  {item.note && <div className="ff-item-note">📝 {item.note}</div>}
                </div>
              </div>
            ))}
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
          <label className="ff-tracking-label">Mã vận đơn (bắt buộc)</label>
          <input
            className="ff-tracking-field"
            type="text"
            placeholder="Nhập mã vận đơn..."
            value={trackingCode}
            onChange={e => setTrackingCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && trackingCode.trim() && handleConfirmShipped()}
            autoFocus
          />
          <div className="ff-tracking-actions">
            <button className="ff-tracking-cancel" onClick={() => { setShowTracking(false); setTrackingCode(''); }}>Huỷ</button>
            <button className="ff-tracking-confirm" onClick={handleConfirmShipped} disabled={!trackingCode.trim()}>
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
  const [columns, setColumns] = useState<Record<FulfillmentStatus, FulfillmentOrder[]>>({
    new: [], preparing: [], packing: [], shipped: [],
  });
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
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
        productOrdersApi.listFulfillment('shipped'),
      ]);
      setColumns({
        new:       newRes.data.orders ?? [],
        preparing: preparingRes.data.orders ?? [],
        packing:   packingRes.data.orders ?? [],
        shipped:   shippedRes.data.orders ?? [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    setSearching(true);
    setSearchError('');
    setSearchResult(null);
    try {
      const res = await productOrdersApi.searchOrder(searchCode.trim());
      setSearchResult(res.data as SearchResult);
    } catch {
      setSearchError('Không tìm thấy đơn hàng với mã: ' + searchCode.trim());
    } finally {
      setSearching(false);
    }
  };

  const handleAdvance = async (id: number, type: OrderType, nextStatus: FulfillmentStatus, trackingCode?: string) => {
    const apiStatus = STATUS_TO_API[nextStatus];
    if (!apiStatus) return;
    try {
      if (type === 'qr_keychain') {
        await productOrdersApi.updateQRKeychainFulfillment(id, apiStatus, trackingCode);
      } else {
        await productOrdersApi.updateFulfillment(id, apiStatus, trackingCode);
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
      <div className="ff-search-bar">
        <input
          ref={searchRef}
          className="ff-search-input"
          type="text"
          placeholder="Tìm đơn hàng theo mã (VD: INXK29..., tên QR...)"
          value={searchCode}
          onChange={e => { setSearchCode(e.target.value); setSearchError(''); setSearchResult(null); }}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <button className="ff-search-btn" onClick={handleSearch} disabled={searching || !searchCode.trim()}>
          {searching ? '...' : '🔍 Tìm'}
        </button>
      </div>

      {searchError && <div className="ff-search-error">{searchError}</div>}

      {searchResult && (
        <div className="ff-search-result">
          <div className="ff-search-result-info">
            <strong>{searchResult.order.invoice_number}</strong>
            {' — '}
            {searchResult.order.customer_name}
            {' — '}
            {formatMoney(Number(searchResult.order.total_amount))}
            <span className={`ff-modal-payment ff-modal-payment--${searchResult.order.payment_status ?? 'pending'}`}>
              {searchResult.order.payment_status === 'paid' ? '✓ Đã thanh toán' : '⏳ Chưa thanh toán'}
            </span>
            {searchResult.order.fulfillment_status && searchResult.order.payment_status === 'paid' && (
              <span className={`ff-modal-stage ff-modal-stage--${searchResult.order.fulfillment_status}`}>
                {searchResult.order.fulfillment_label}
              </span>
            )}
            {searchResult.order.tracking_code && (
              <span>🚚 {searchResult.order.tracking_code}</span>
            )}
          </div>
          <button
            className="ff-search-open-btn"
            onClick={() => setDetailOrder({ result: searchResult })}
          >
            Xem & sửa chi tiết →
          </button>
        </div>
      )}

      {/* Kanban board */}
      <div className="ff-board">
        {COLUMNS.map(col => {
          const orders = columns[col.key];
          return (
            <div key={col.key} className={`ff-column ff-column--${col.key}`}>
              <div className="ff-column-header">
                <span>{col.icon} {col.label}</span>
                <span className="ff-column-count">{orders.length}</span>
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

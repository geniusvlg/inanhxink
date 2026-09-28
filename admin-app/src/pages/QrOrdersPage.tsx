import { useCallback, useState, useEffect } from 'react';
import { ordersApi, qrNamesApi } from '../services/api';
import { type Order } from '../types';
import '../components/Layout.css';

const PAYMENT_OPTIONS = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];

const PAYMENT_LABEL: Record<string, string> = {
  pending:   'Chờ thanh toán',
  paid:      'Đã thanh toán',
  failed:    'Thất bại',
  refunded:  'Hoàn tiền',
  cancelled: 'Đã huỷ',
};

const AUDIO_OPTIONS: { value: string; label: string }[] = [
  { value: 'music', label: 'Có nhạc' },
  { value: 'voice', label: 'Có ghi âm' },
  { value: 'both', label: 'Cả nhạc và ghi âm' },
  { value: 'music_only', label: 'Chỉ nhạc' },
  { value: 'voice_only', label: 'Chỉ ghi âm' },
  { value: 'none', label: 'Không nhạc, không ghi âm' },
];

const RELEASED_STYLE: React.CSSProperties = {
  background: '#fef2f2', color: '#b91c1c', border: '1px solid #fca5a5', fontSize: '0.7rem',
};

const MUSIC_STYLE: React.CSSProperties = {
  background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd', fontSize: '0.7rem',
};

const VOICE_STYLE: React.CSSProperties = {
  background: '#fce7f3', color: '#9d174d', border: '1px solid #f9a8d4', fontSize: '0.7rem',
};

const PAYMENT_STYLE: Record<string, React.CSSProperties> = {
  pending:   { background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24' },
  paid:      { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' },
  failed:    { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
  refunded:  { background: '#e0f2fe', color: '#075985', border: '1px solid #7dd3fc' },
  cancelled: { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' },
};

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span style={{
      padding: '0.2rem 0.65rem',
      borderRadius: '999px',
      fontWeight: 600,
      fontSize: '0.78rem',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {label}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  return <Badge label={PAYMENT_LABEL[status] ?? status} style={PAYMENT_STYLE[status] ?? {}} />;
}

function vnd(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '—';
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function addonLine(enabled: boolean, price?: number | string | null) {
  if (!enabled) return 'Không';
  const amount = Number(price ?? 0);
  return amount > 0 ? `Có (+${amount.toLocaleString('vi-VN')}đ)` : 'Có';
}

function musicVolumePercent(order: Order): number | null {
  const hasMusic = !!(order.music_added || order.has_music);
  if (!hasMusic) return null;
  const raw = order.music_volume;
  if (raw === null || raw === undefined || raw === '') {
    return order.voice_recording_added || order.has_voice ? 4 : 100;
  }
  const volume = Number(raw);
  if (!Number.isFinite(volume)) return null;
  return Math.round(Math.min(1, Math.max(0, volume)) * 100);
}

function musicVolumeLabel(order: Order) {
  const percent = musicVolumePercent(order);
  if (percent == null) return '—';
  const raw = order.music_volume;
  const stored = raw !== null && raw !== undefined && raw !== '';
  return stored ? `${percent}%` : `${percent}% (mặc định)`;
}

function AudioBadges({ music, voice }: { music?: boolean; voice?: boolean }) {
  if (!music && !voice) return <span style={{ color: '#94a3b8' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {music && <Badge label="Nhạc" style={MUSIC_STYLE} />}
      {voice && <Badge label="Ghi âm" style={VOICE_STYLE} />}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [filterPayment, setFilterPayment] = useState('');
  const [filterAudio, setFilterAudio] = useState('');
  const [filterKeychain, setFilterKeychain] = useState('');
  const [qrQuery, setQrQuery] = useState('');
  const [qrName, setQrName] = useState('');
  const [detail, setDetail]           = useState<Order | null>(null);
  const [editPayment, setEditPayment] = useState('');
  const [saving, setSaving]           = useState(false);
  const [volumePercent, setVolumePercent] = useState('');
  const [savingVolume, setSavingVolume] = useState(false);
  const [release, setRelease]         = useState<Order | null>(null);
  const [releaseConfirm, setReleaseConfirm] = useState('');
  const [releasing, setReleasing]     = useState(false);
  const LIMIT = 20;

  const load = useCallback((p: number) => {
    setLoading(true);
    const params: Record<string, string | number> = { page: p, limit: LIMIT };
    if (filterPayment) params.payment_status = filterPayment;
    if (filterAudio) params.audio = filterAudio;
    if (filterKeychain) params.keychain = filterKeychain;
    if (qrName) params.qr_name = qrName;
    ordersApi.list(params)
      .then(r => { setOrders(r.data.orders ?? []); setTotal(r.data.total ?? 0); })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [filterPayment, filterAudio, filterKeychain, qrName]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQrName(qrQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [qrQuery]);

  useEffect(() => { load(1); setPage(1); }, [filterPayment, filterAudio, filterKeychain, qrName, load]);
  useEffect(() => { load(page); }, [page, load]);

  const openDetail = (o: Order) => {
    setDetail(o);
    setEditPayment(o.payment_status);
    const current = musicVolumePercent(o);
    setVolumePercent(current == null ? '' : String(current));
  };

  const handleSaveVolume = async () => {
    if (!detail) return;
    const percent = Number(volumePercent);
    if (volumePercent.trim() === '' || !Number.isInteger(percent) || percent < 0 || percent > 100) {
      alert('Âm lượng nhạc phải từ 0% đến 100%.');
      return;
    }
    setSavingVolume(true);
    try {
      const res = await qrNamesApi.updateVolume(detail.qr_name, percent / 100);
      setDetail({ ...detail, music_volume: res.data.musicVolume });
      load(page);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Không thể cập nhật âm lượng nhạc.');
    } finally {
      setSavingVolume(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!detail) { setDetail(null); return; }
    if (editPayment === detail.payment_status) { setDetail(null); return; }
    setSaving(true);
    try {
      await ordersApi.updateStatus(detail.id, { payment_status: editPayment });
      load(page);
      setDetail(null);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Không thể cập nhật trạng thái thanh toán.');
    } finally {
      setSaving(false);
    }
  };

  const openRelease = (o: Order) => {
    setRelease(o);
    setReleaseConfirm('');
  };

  const handleRelease = async () => {
    if (!release || releaseConfirm.trim().toLowerCase() !== release.qr_name) return;
    setReleasing(true);
    try {
      const res = await qrNamesApi.release(release.qr_name);
      setRelease(null);
      setDetail(null);
      load(page);
      alert(res.data.message);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Không thể thu hồi tên QR.');
    } finally {
      setReleasing(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="admin-page-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 className="admin-page-title">🔳 Đơn QR</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ width: 220 }}
            placeholder="Tên QR"
            value={qrQuery}
            onChange={e => setQrQuery(e.target.value)}
          />
          <select className="form-select" style={{ width: 'auto' }} value={filterAudio} onChange={e => setFilterAudio(e.target.value)}>
            <option value="">Tất cả âm thanh</option>
            {AUDIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={filterKeychain} onChange={e => setFilterKeychain(e.target.value)}>
            <option value="">Tất cả móc khoá</option>
            <option value="yes">Có móc khoá</option>
            <option value="no">Không móc khoá</option>
          </select>
          <select className="form-select" style={{ width: 'auto' }} value={filterPayment} onChange={e => setFilterPayment(e.target.value)}>
            <option value="">Tất cả thanh toán</option>
            {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
          </select>
        </div>
      </div>

      {loading ? <div className="admin-loading">Đang tải...</div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th><th>QR Name</th><th>Khách hàng</th>
                  <th>Template</th><th>Âm thanh</th><th>Tổng tiền</th>
                  <th>Thanh toán</th><th>Ngày tạo</th><th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                      Không có đơn phù hợp
                    </td>
                  </tr>
                )}
                {orders.map(o => (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(o)}>
                    <td>{o.id}</td>
                    <td>
                      <code>{o.qr_name}</code>
                      {o.qr_name_released_at && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <Badge label="Đã thu hồi tên" style={RELEASED_STYLE} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div>{o.customer_name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{o.customer_phone}</div>
                    </td>
                    <td>{o.template_name}</td>
                    <td><AudioBadges music={o.has_music} voice={o.has_voice} /></td>
                    <td>{o.total_amount?.toLocaleString('vi-VN')}đ</td>
                    <td><PaymentBadge status={o.payment_status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleString('vi-VN', { day: '2-digit', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      {!o.qr_name_released_at && (
                        <button
                          className="btn-secondary"
                          title={`Thu hồi tên QR "${o.qr_name}" để người khác đặt lại`}
                          style={{ padding: '0.25rem 0.55rem', color: '#b91c1c' }}
                          onClick={e => { e.stopPropagation(); openRelease(o); }}
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Trước</button>
            <span style={{ lineHeight: '2.1rem', color: '#64748b', fontSize: '0.875rem' }}>
              Trang {page} / {totalPages} ({total} đơn)
            </span>
            <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Tiếp →</button>
          </div>
        </>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Chi tiết đơn QR #{detail.id}</h2>
            <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
              <tbody>
                {([
                  ['QR Name',    detail.qr_name],
                  ['Khách hàng', detail.customer_name],
                  ['Email',      detail.customer_email],
                  ['SĐT',        detail.customer_phone],
                  ['Template',   detail.template_name],
                  ['Giá mẫu hiện tại', detail.template_price == null ? '—' : vnd(detail.template_price)],
                  ['Nhạc nền',   addonLine(!!(detail.music_added || detail.has_music))],
                  ['Âm lượng nhạc', musicVolumeLabel(detail)],
                  ['Ghi âm',     addonLine(!!(detail.voice_recording_added || detail.has_voice), detail.voice_recording_price)],
                  ['Móc khoá',   addonLine(!!detail.keychain_purchased, detail.keychain_price)],
                  ['Tip',        Number(detail.tip_amount) > 0 ? vnd(detail.tip_amount) : 'Không'],
                  ['Voucher',    detail.voucher_code
                    ? (Number(detail.voucher_discount) > 0
                      ? `${detail.voucher_code} (−${vnd(detail.voucher_discount)})`
                      : detail.voucher_code)
                    : '—'],
                  ['Tổng tiền',  vnd(detail.total_amount)],
                  ['Ngày tạo',   new Date(detail.created_at).toLocaleString('vi-VN')],
                ] as [string, string][]).map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', width: '35%' }}>{k}</td>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#1e293b' }}>
                      {k === 'Âm lượng nhạc' && !detail.qr_name_released_at && musicVolumePercent(detail) != null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={volumePercent}
                            style={{ width: 88 }}
                            onChange={e => setVolumePercent(e.target.value)}
                          />
                          <span>%</span>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.75rem' }}
                            disabled={savingVolume || (
                              detail.music_volume != null && detail.music_volume !== ''
                              && volumePercent === String(musicVolumePercent(detail))
                            )}
                            onClick={handleSaveVolume}
                          >
                            {savingVolume ? 'Đang lưu...' : 'Lưu'}
                          </button>
                        </div>
                      ) : v}
                    </td>
                  </tr>
                ))}

                {/* Payment status */}
                <tr>
                  <td style={{ padding: '0.4rem 0.5rem', fontWeight: 600, color: '#475569', verticalAlign: 'middle' }}>Thanh toán</td>
                  <td style={{ padding: '0.4rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                      <PaymentBadge status={detail.payment_status} />
                      {editPayment !== detail.payment_status && (
                        <><span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span><PaymentBadge status={editPayment} /></>
                      )}
                    </div>
                    <select className="form-select" style={{ width: '100%' }} value={editPayment} onChange={e => setEditPayment(e.target.value)}>
                      {PAYMENT_OPTIONS.map(s => <option key={s} value={s}>{PAYMENT_LABEL[s]}</option>)}
                    </select>
                  </td>
                </tr>

              </tbody>
            </table>
            <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
              {detail.qr_name_released_at ? (
                <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                  Tên QR đã thu hồi {new Date(detail.qr_name_released_at).toLocaleString('vi-VN')}
                </span>
              ) : (
                <button
                  className="btn-secondary"
                  style={{ color: '#b91c1c' }}
                  onClick={() => openRelease(detail)}
                >
                  🗑 Thu hồi tên QR
                </button>
              )}
              <span style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" onClick={() => setDetail(null)}>Đóng</button>
                <button className="btn-primary" onClick={handleSaveStatus} disabled={saving}>
                  {saving ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </span>
            </div>
          </div>
        </div>
      )}

      {release && (
        <div className="modal-overlay" onClick={() => setRelease(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Thu hồi tên QR</h2>
            <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6 }}>
              Tên <code>{release.qr_name}</code> sẽ được trả về để khách khác đặt lại. Hành động này{' '}
              <strong>không thể hoàn tác</strong>:
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.7, paddingLeft: '1.2rem' }}>
              <li>Xoá trang <code>{release.qr_name}.inanhxink.com</code> và toàn bộ nội dung QR</li>
              <li>Xoá tất cả ảnh, nhạc và ghi âm của tên này trên S3</li>
              <li>Đơn hàng vẫn được giữ lại để đối chiếu doanh thu</li>
            </ul>
            <label className="form-label" style={{ marginTop: '0.75rem' }}>
              Nhập <code>{release.qr_name}</code> để xác nhận
            </label>
            <input
              className="form-input"
              value={releaseConfirm}
              autoFocus
              placeholder={release.qr_name}
              onChange={e => setReleaseConfirm(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRelease(null)}>Huỷ</button>
              <button
                className="btn-primary"
                style={{ background: '#dc2626' }}
                disabled={releasing || releaseConfirm.trim().toLowerCase() !== release.qr_name}
                onClick={handleRelease}
              >
                {releasing ? 'Đang thu hồi...' : 'Thu hồi tên QR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

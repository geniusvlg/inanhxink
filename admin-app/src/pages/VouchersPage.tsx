import { useState, useEffect } from 'react';
import { vouchersApi } from '../services/api';
import { type Voucher } from '../types';
import '../components/Layout.css';

const emptyForm = (): Partial<Voucher> => ({
  code: '', discount_type: 'percentage', discount_value: 10,
  max_uses: null, expires_at: null, is_active: true,
});

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState<Voucher | null>(null);
  const [form, setForm]         = useState<Partial<Voucher>>(emptyForm());
  const [saving, setSaving]     = useState(false);

  const load = () => {
    setLoading(true);
    vouchersApi.list()
      .then(r => setVouchers(r.data.vouchers ?? []))
      .catch(() => setVouchers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setShowModal(true); };
  const openEdit   = (v: Voucher) => { setEditing(v); setForm({ ...v }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await vouchersApi.update(editing.id, form);
      } else {
        await vouchersApi.create(form);
      }
      closeModal();
      load();
    } catch {
      alert('Lỗi khi lưu voucher');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: Voucher) => {
    if (!confirm(`Ẩn voucher "${v.code}"?`)) return;
    await vouchersApi.delete(v.id);
    load();
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🎟️ Voucher</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm voucher</button>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th><th>Loại</th><th>Giá trị</th>
              <th>Đã dùng / Tối đa</th><th>Hết hạn</th>
              <th>Trạng thái</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map(v => (
              <tr key={v.id}>
                <td><strong>{v.code}</strong></td>
                <td>{v.discount_type === 'percentage' ? 'Phần trăm' : 'Cố định'}</td>
                <td>{v.discount_type === 'percentage' ? `${v.discount_value}%` : `${v.discount_value.toLocaleString('vi-VN')}đ`}</td>
                <td>{v.used_count} / {v.max_uses ?? '∞'}</td>
                <td>{v.expires_at ? new Date(v.expires_at).toLocaleDateString('vi-VN') : '—'}</td>
                <td><span className={`badge ${v.is_active ? 'badge-green' : 'badge-red'}`}>{v.is_active ? 'Hoạt động' : 'Ẩn'}</span></td>
                <td style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn-edit"   onClick={() => openEdit(v)}>Sửa</button>
                  <button className="btn-danger" onClick={() => handleDelete(v)}>Ẩn</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Sửa voucher' : 'Thêm voucher'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Code *</label>
                <input className="form-input" value={form.code ?? ''} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required disabled={!!editing} />
              </div>
              <div className="form-group">
                <label className="form-label">Loại giảm giá *</label>
                <select className="form-select" value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percentage' | 'fixed' }))}>
                  <option value="percentage">Phần trăm (%)</option>
                  <option value="fixed">Cố định (đ)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Giá trị *</label>
                <input className="form-input" type="number" min="0" value={form.discount_value ?? 0} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} required />
              </div>
              <div className="form-group">
                <label className="form-label">Số lần dùng tối đa</label>
                <input className="form-input" type="number" min="1" placeholder="Không giới hạn" value={form.max_uses ?? ''} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Ngày hết hạn</label>
                <input className="form-input" type="date" value={form.expires_at ? form.expires_at.slice(0, 10) : ''} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value || null }))} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="checkbox" id="v_active" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <label htmlFor="v_active" className="form-label" style={{ margin: 0 }}>Hoạt động</label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Huỷ</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

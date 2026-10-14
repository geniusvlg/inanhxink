import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiErrorMessage, authApi } from '../services/api';
import '../components/Layout.css';

const ACTION_LABEL: Record<string, string> = {
  view: 'Xem',
  create: 'Thêm',
  update: 'Sửa',
  delete: 'Xoá',
};

const AREA_LABEL: Record<string, string> = {
  qr_templates: 'QR Templates',
  thiep: 'Thiệp',
  khung_anh: 'Khung Ảnh',
  so_scrapbook: 'Sổ & Scrapbook',
  khac: 'Các sản phẩm khác',
  set_qua_tang: 'Set quà tặng',
  in_anh: 'In Ảnh',
  featured: 'SP trang chủ',
  categories: 'Danh mục',
  product_reviews: 'Đánh giá SP',
  product_orders: 'Đơn sản phẩm',
  fulfillment: 'Xử lý đơn hàng',
  qr_orders: 'Đơn QR',
  vouchers: 'Voucher',
  testimonials: 'Feedback',
  banners: 'Banner',
  hero_shots: 'Polaroid trang chủ',
  config: 'Cấu hình',
};

const AREA_ORDER = Object.keys(AREA_LABEL);

function permissionGroups(permissions: string[]) {
  const byArea = new Map<string, string[]>();
  for (const key of permissions) {
    const dot = key.lastIndexOf('.');
    if (dot <= 0) continue;
    const area = key.slice(0, dot);
    const action = key.slice(dot + 1);
    const list = byArea.get(area) ?? [];
    list.push(action);
    byArea.set(area, list);
  }
  const ordered = AREA_ORDER.filter((area) => byArea.has(area));
  for (const area of byArea.keys()) {
    if (!ordered.includes(area)) ordered.push(area);
  }
  return ordered.map((area) => ({
    area,
    label: AREA_LABEL[area] ?? area,
    actions: byArea.get(area) ?? [],
  }));
}

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSaved, setNameSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  if (!user) return <div className="admin-loading">Đang tải...</div>;

  const groups = permissionGroups(user.permissions);

  const saveDisplayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError('');
    setNameSaved(false);
    setSavingName(true);
    try {
      const res = await authApi.updateProfile(displayName.trim());
      setUser(res.data.user);
      setDisplayName(res.data.user.display_name);
      setNameSaved(true);
    } catch (err) {
      setNameError(apiErrorMessage(err, 'Không lưu được tên hiển thị'));
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Không đổi được mật khẩu'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🪪 profile</h1>
      </div>

      <div className="admin-table-wrap" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div className="form-group">
          <div className="form-label">Tên đăng nhập</div>
          <div>{user.username}</div>
        </div>
        <form onSubmit={saveDisplayName}>
          <div className="form-group">
            <label className="form-label" htmlFor="display-name">Tên hiển thị</label>
            <input
              id="display-name"
              className="form-input"
              value={displayName}
              maxLength={100}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          {nameError && <div style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{nameError}</div>}
          {nameSaved && <div style={{ color: '#16a34a', marginBottom: '0.75rem' }}>Đã lưu tên hiển thị.</div>}
          <button className="btn-primary" type="submit" disabled={savingName}>
            {savingName ? 'Đang lưu...' : 'Lưu tên hiển thị'}
          </button>
        </form>
        <div className="form-group" style={{ marginBottom: 0, marginTop: '1.25rem' }}>
          <div className="form-label">Vai trò</div>
          <div>
            {user.role.name}
            {user.role.is_system && <span className="badge badge-blue" style={{ marginLeft: 8 }}>Hệ thống</span>}
          </div>
        </div>
      </div>

      <div className="admin-table-wrap" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Quyền của vai trò</div>
        {groups.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>Tài khoản chưa được cấp quyền nào.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {groups.map((group) => (
              <div key={group.area} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <strong style={{ minWidth: 160 }}>{group.label}</strong>
                <span style={{ color: '#475569' }}>
                  {group.actions.map((action) => ACTION_LABEL[action] ?? action).join(', ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="admin-table-wrap" style={{ padding: '1.25rem 1.5rem' }} onSubmit={changePassword}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Đổi mật khẩu</div>
        {error && <div style={{ color: '#b91c1c', marginBottom: '0.75rem' }}>{error}</div>}
        {saved && <div style={{ color: '#16a34a', marginBottom: '0.75rem' }}>Đã đổi mật khẩu.</div>}
        <div className="form-group">
          <label className="form-label" htmlFor="current-password">Mật khẩu hiện tại</label>
          <input id="current-password" className="form-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="new-password">Mật khẩu mới</label>
          <input id="new-password" className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
          <input id="confirm-password" className="form-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
        </div>
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? 'Đang lưu...' : 'Đổi mật khẩu'}
        </button>
      </form>
    </div>
  );
}

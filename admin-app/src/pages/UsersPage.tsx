import { useEffect, useState } from 'react';
import { apiErrorMessage, rolesApi, usersApi, type RoleRecord, type StaffUser } from '../services/api';
import '../components/Layout.css';

interface Draft {
  display_name: string;
  role_id: number;
  is_active: boolean;
  password: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role_id: 0 });

  const load = () => {
    setLoading(true);
    Promise.all([usersApi.list(), rolesApi.list()])
      .then(([userRes, roleRes]) => {
        const nextUsers = userRes.data.users ?? [];
        const nextRoles = roleRes.data.roles ?? [];
        setUsers(nextUsers);
        setRoles(nextRoles);
        setDrafts(Object.fromEntries(nextUsers.map((user) => [user.id, {
          display_name: user.display_name ?? '',
          role_id: user.role.id,
          is_active: user.is_active,
          password: '',
        }])));
        setForm((current) => ({ ...current, role_id: current.role_id || nextRoles[0]?.id || 0 }));
      })
      .catch((err) => setError(apiErrorMessage(err, 'Không tải được nhân viên')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const patchDraft = (id: number, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  };

  const save = async (user: StaffUser) => {
    const draft = drafts[user.id];
    setSavingId(user.id);
    setError('');
    try {
      await usersApi.update(user.id, {
        display_name: draft.display_name,
        role_id: draft.role_id,
        is_active: draft.is_active,
      });
      if (draft.password) {
        await usersApi.resetPassword(user.id, draft.password);
      }
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được nhân viên'));
    } finally {
      setSavingId(null);
    }
  };

  const create = async () => {
    setSavingId(0);
    setError('');
    try {
      await usersApi.create(form);
      setCreating(false);
      setForm({ username: '', password: '', display_name: '', role_id: roles[0]?.id ?? 0 });
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không tạo được nhân viên'));
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">👤 quản lý nhân viên</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Thêm nhân viên</button>
      </div>
      {error && <div style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên đăng nhập</th>
              <th>Tên hiển thị</th>
              <th>Vai trò</th>
              <th>Hoạt động</th>
              <th>Mật khẩu mới</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const draft = drafts[user.id];
              if (!draft) return null;
              return (
                <tr key={user.id}>
                  <td><strong>{user.username}</strong></td>
                  <td>
                    <input className="form-input" value={draft.display_name} onChange={(e) => patchDraft(user.id, { display_name: e.target.value })} />
                  </td>
                  <td>
                    <select className="form-input" value={draft.role_id} onChange={(e) => patchDraft(user.id, { role_id: Number(e.target.value) })}>
                      {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="checkbox" checked={draft.is_active} onChange={(e) => patchDraft(user.id, { is_active: e.target.checked })} />
                  </td>
                  <td>
                    <input className="form-input" type="password" placeholder="Giữ nguyên" value={draft.password} onChange={(e) => patchDraft(user.id, { password: e.target.value })} />
                  </td>
                  <td>
                    <button className="btn-primary" disabled={savingId === user.id} onClick={() => save(user)}>
                      {savingId === user.id ? 'Đang lưu...' : 'Lưu'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Thêm nhân viên</h2>
            <div className="form-group">
              <label className="form-label">Tên đăng nhập</label>
              <input className="form-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Tên hiển thị</label>
              <input className="form-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Mật khẩu</label>
              <input className="form-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Vai trò</label>
              <select className="form-input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn-secondary" onClick={() => setCreating(false)}>Huỷ</button>
              <button className="btn-primary" disabled={savingId === 0} onClick={create}>{savingId === 0 ? 'Đang tạo...' : 'Tạo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

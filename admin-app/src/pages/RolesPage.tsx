import { useEffect, useState } from 'react';
import { apiErrorMessage, rolesApi, type PermissionArea, type RoleRecord } from '../services/api';
import '../components/Layout.css';

const ACTION_LABEL: Record<string, string> = {
  view: 'Xem',
  create: 'Thêm',
  update: 'Sửa',
  delete: 'Xoá',
};

const emptyForm = { name: '', description: '', permissions: [] as string[] };

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [areas, setAreas] = useState<PermissionArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([rolesApi.list(), rolesApi.catalog()])
      .then(([roleRes, catalogRes]) => {
        setRoles(roleRes.data.roles ?? []);
        setAreas(catalogRes.data.areas ?? []);
      })
      .catch((err) => setError(apiErrorMessage(err, 'Không tải được vai trò')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setError('');
  };

  const openEdit = (role: RoleRecord) => {
    setCreating(false);
    setEditing(role);
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissions: role.is_system ? [] : [...role.permissions],
    });
    setError('');
  };

  const close = () => {
    setEditing(null);
    setCreating(false);
  };

  const toggle = (key: string) => {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter((item) => item !== key)
        : [...current.permissions, key],
    }));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) await rolesApi.update(editing.id, form);
      else await rolesApi.create(form);
      close();
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không lưu được vai trò'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (role: RoleRecord) => {
    if (!confirm(`Xoá vai trò "${role.name}"?`)) return;
    try {
      await rolesApi.delete(role.id);
      load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Không xoá được vai trò'));
    }
  };

  const formOpen = creating || editing;
  const locked = !!editing?.is_system;

  if (loading) return <div className="admin-loading">Đang tải...</div>;

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="admin-page-title">🎭 Role</h1>
        <button className="btn-primary" onClick={openCreate}>+ Thêm vai trò</button>
      </div>
      {error && <div style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Mô tả</th>
              <th>Số quyền</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id}>
                <td>
                  <strong>{role.name}</strong>
                  {role.is_system && <span className="badge badge-blue" style={{ marginLeft: 8 }}>Hệ thống</span>}
                </td>
                <td>{role.description || '—'}</td>
                <td>{role.permissions.length}</td>
                <td style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-edit" onClick={() => openEdit(role)}>{role.is_system ? 'Xem' : 'Sửa'}</button>
                  {!role.is_system && <button className="btn-danger" onClick={() => remove(role)}>Xoá</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="modal-overlay" onClick={close}>
          <div className="modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">{locked ? 'Vai trò Admin' : editing ? 'Sửa vai trò' : 'Thêm vai trò'}</h2>
            {locked && <p style={{ color: '#64748b', marginTop: 0 }}>Vai trò hệ thống luôn có toàn bộ quyền và không sửa được.</p>}
            <div className="form-group">
              <label className="form-label">Tên</label>
              <input className="form-input" value={locked ? editing!.name : form.name} disabled={locked} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Mô tả</label>
              <input className="form-input" value={locked ? (editing!.description ?? '') : form.description} disabled={locked} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 360, overflow: 'auto' }}>
              {areas.map((area) => (
                <div key={area.key}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{area.label}</div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {area.actions.map((action) => {
                      const key = `${area.key}.${action}`;
                      const checked = locked ? editing!.permissions.includes(key) : form.permissions.includes(key);
                      return (
                        <label key={key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(key)} />
                          {ACTION_LABEL[action] ?? action}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn-secondary" onClick={close}>Đóng</button>
              {!locked && <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

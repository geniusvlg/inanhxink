import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { firstAllowedPath } from '../auth/permissions';

export default function ProtectedRoute() {
  const { token, ready } = useAuth();
  if (!ready) return <div className="admin-loading">Đang tải...</div>;
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export function HomeRedirect() {
  const { can, ready } = useAuth();
  if (!ready) return <div className="admin-loading">Đang tải...</div>;
  const dest = firstAllowedPath(can);
  if (!dest) {
    return (
      <div style={{ padding: '2rem', color: '#475569' }}>
        Tài khoản chưa được cấp trang nào. Hãy nhờ Admin gán quyền.
      </div>
    );
  }
  return <Navigate to={dest} replace />;
}

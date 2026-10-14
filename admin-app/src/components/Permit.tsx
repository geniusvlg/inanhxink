import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Permit({ area, children }: { area: string; children: ReactNode }) {
  const { can, ready } = useAuth();
  if (!ready) return <div className="admin-loading">Đang tải...</div>;
  if (!can(`${area}.view`)) return <Navigate to="/" replace />;
  return children;
}

export function PermitSystem({ children }: { children: ReactNode }) {
  const { isSystem, ready } = useAuth();
  if (!ready) return <div className="admin-loading">Đang tải...</div>;
  if (!isSystem) return <Navigate to="/" replace />;
  return children;
}

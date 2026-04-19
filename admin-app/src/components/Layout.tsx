import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { type ReactNode, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

function QrIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="16.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

const NAV: { to: string; label: ReactNode }[] = [
  { to: '/products',          label: <><QrIcon /> QR Templates</> },
  { to: '/thiep',             label: '🎴 Thiệp' },
  { to: '/khung-anh',        label: '🖼️ Khung Ảnh' },
  { to: '/so-scrapbook',     label: '📒 Sổ & Scrapbook' },
  { to: '/cac-san-pham-khac', label: '📦 Các Sản Phẩm Khác' },
  { to: '/set-qua-tang',     label: '🎁 Set Quà Tặng' },
  { to: '/in-anh',           label: '🖨️ In Ảnh' },
  { to: '/featured-on-home', label: '🏠 SP trang chủ' },
  { to: '/categories',       label: '🏷️ Danh mục' },
  { to: '/orders',           label: '📋 Đơn hàng' },
  { to: '/vouchers',         label: '🎟️ Voucher' },
  { to: '/testimonials',     label: '💬 Feedback' },
  { to: '/banners',          label: '🖼️ Banner' },
  { to: '/hero-shots',       label: '📸 Polaroid trang chủ' },
  { to: '/config',           label: '⚙️ Cấu hình' },
];

export default function Layout() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change (mobile nav)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="admin-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`admin-sidebar${sidebarOpen ? ' admin-sidebar--open' : ''}`}>
        <div className="admin-sidebar-logo">
          <span>🛠️</span>
          <span>Admin</span>
        </div>
        <nav className="admin-sidebar-nav">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? ' active' : ''}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <span className="admin-username">👤 {username}</span>
          <button className="admin-logout-btn" onClick={handleLogout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="admin-main">
        {/* Mobile top bar */}
        <div className="admin-topbar">
          <button className="admin-hamburger" onClick={() => setSidebarOpen(o => !o)}>
            ☰
          </button>
          <span className="admin-topbar-title">🛠️ Admin</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { type ReactNode, useState } from 'react';
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

const NAV: { to: string; area: string; label: ReactNode }[] = [
  { to: '/products',          area: 'qr_templates',    label: <><QrIcon /> QR Templates</> },
  { to: '/thiep',             area: 'thiep',           label: '🎴 Thiệp' },
  { to: '/khung-anh',        area: 'khung_anh',       label: '🖼️ Khung Ảnh' },
  { to: '/so-scrapbook',     area: 'so_scrapbook',    label: '📒 Sổ & Scrapbook' },
  { to: '/cac-san-pham-khac', area: 'khac',           label: '📦 Các Sản Phẩm Khác' },
  { to: '/set-qua-tang',     area: 'set_qua_tang',    label: '🎁 Set Quà Tặng' },
  { to: '/in-anh',           area: 'in_anh',          label: '🖨️ In Ảnh' },
  { to: '/featured-on-home', area: 'featured',        label: '🏠 SP trang chủ' },
  { to: '/categories',       area: 'categories',      label: '🏷️ Danh mục' },
  { to: '/product-reviews',  area: 'product_reviews', label: '⭐ Đánh giá SP' },
  { to: '/orders',           area: 'product_orders',  label: '📦 Đơn sản phẩm' },
  { to: '/fulfillment',      area: 'fulfillment',     label: '⚙️ Xử lý đơn hàng' },
  { to: '/qr-orders',        area: 'qr_orders',       label: '🔳 Đơn QR' },
  { to: '/vouchers',         area: 'vouchers',        label: '🎟️ Voucher' },
  { to: '/testimonials',     area: 'testimonials',    label: '💬 Feedback' },
  { to: '/banners',          area: 'banners',         label: '🖼️ Banner' },
  { to: '/hero-shots',       area: 'hero_shots',      label: '📸 Polaroid trang chủ' },
  { to: '/config',           area: 'config',          label: '⚙️ Cấu hình' },
];

export default function Layout() {
  const { username, logout, can, isSystem } = useAuth();
  const nav = [
    ...NAV.filter((item) => can(`${item.area}.view`)),
    ...(isSystem ? [
      { to: '/vai-tro', label: '🎭 Role' },
      { to: '/nhan-vien', label: '👤 Quản lý nhân viên' },
    ] : []),
    { to: '/ho-so', label: '🪪 Profile' },
  ];
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `admin-nav-link${isActive ? ' active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <NavLink to="/ho-so" className="admin-username" onClick={() => setSidebarOpen(false)}>👤 {username}</NavLink>
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

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useCart } from '../contexts/CartContext';
import CartDrawer from './CartDrawer';
import './SiteHeader.css';

interface SiteHeaderProps {
  activePage?: 'home' | 'qr-yeu-thuong' | 'thiep' | 'khung-anh' | 'so-scrapbook' | 'set-qua-tang' | 'cac-san-pham-khac' | 'in-anh' | 'danh-gia' | 'tra-cuu-don-hang';
}

const NAV_PAGES = [
  { flag: 'page_qr_yeu_thuong', path: '/qr-yeu-thuong', active: 'qr-yeu-thuong', label: 'QR Yêu Thương' },
  { flag: 'page_thiep', path: '/thiep', active: 'thiep', label: 'Thiệp' },
  { flag: 'page_khung_anh', path: '/khung-anh', active: 'khung-anh', label: 'Khung Ảnh' },
  { flag: 'page_so_scrapbook', path: '/so-scrapbook', active: 'so-scrapbook', label: 'Sổ & Scrapbook' },
  { flag: 'page_set_qua_tang', path: '/set-qua-tang', active: 'set-qua-tang', label: 'Set Quà Tặng' },
  { flag: 'page_cac_san_pham_khac', path: '/cac-san-pham-khac', active: 'cac-san-pham-khac', label: 'Các Sản Phẩm Khác' },
  { flag: 'page_in_anh', path: '/in-anh', active: 'in-anh', label: 'In Ảnh' },
  { flag: 'page_order_tracking', path: '/tra-cuu-don-hang', active: 'tra-cuu-don-hang', label: 'Tra cứu đơn hàng' },
  { flag: 'page_danh_gia', path: '/danh-gia', active: 'danh-gia', label: 'Feedback' },
] as const;

function SiteHeader({ activePage }: SiteHeaderProps) {
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const navigate = useNavigate();
  const flags = useFeatureFlags();
  const { totalItems } = useCart();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const linkCls = (key: SiteHeaderProps['activePage']) => `site-nav-link${activePage === key ? ' active' : ''}`;
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const orderedPages = [...NAV_PAGES].sort((a, b) => {
    const aIdx = flags.page_order.indexOf(a.flag);
    const bIdx = flags.page_order.indexOf(b.flag);
    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
  });

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link to="/home" className="site-logo" onClick={closeMobileMenu}>
          <img src="/logo.jpeg" alt="Inanhxink" className="site-logo-img" />
          <span className="site-logo-text">In Ảnh Xink</span>
        </Link>

        <form className="site-search" onSubmit={handleSearch}>
          <input
            className="site-search-input"
            type="text"
            placeholder="Tìm kiếm sản phẩm..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="site-search-btn" type="submit">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </form>

        <button
          type="button"
          className="site-cart-btn"
          aria-label="Giỏ hàng"
          onClick={() => setCartOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/>
          </svg>
          {totalItems > 0 && (
            <span className="site-cart-badge">{totalItems > 99 ? '99+' : totalItems}</span>
          )}
        </button>

        <button
          type="button"
          className={`site-menu-btn${mobileMenuOpen ? ' active' : ''}`}
          aria-label="Mở menu"
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen(v => !v)}
        >
          ☰
        </button>
      </div>

      <div
        className={`site-menu-overlay${mobileMenuOpen ? ' site-menu-overlay--open' : ''}`}
        onClick={closeMobileMenu}
        aria-hidden={!mobileMenuOpen}
      />

      <nav className={`site-header-nav${mobileMenuOpen ? ' site-header-nav--open' : ''}`}>
        <Link to="/home" className="site-drawer-logo-wrap" onClick={closeMobileMenu}>
          <img src="/logo.jpeg" alt="Inanhxink" className="site-drawer-logo" />
          <span className="site-drawer-logo-text">In Ảnh Xink</span>
        </Link>
        <Link to="/home" className={linkCls('home')} onClick={closeMobileMenu}>Trang chủ</Link>
        {orderedPages.map(page => (
          flags[page.flag] && (
            <Link key={page.flag} to={page.path} className={linkCls(page.active)} onClick={closeMobileMenu}>
              {page.label}
            </Link>
          )
        ))}
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}

export default SiteHeader;

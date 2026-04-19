import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './SiteHeader.css';

interface SiteHeaderProps {
  activePage?: 'qr-yeu-thuong' | 'thiep' | 'khung-anh' | 'so-scrapbook' | 'set-qua-tang' | 'cac-san-pham-khac' | 'in-anh' | 'danh-gia';
}

function SiteHeader({ activePage }: SiteHeaderProps) {
  const [query, setQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const flags = useFeatureFlags();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
      setMobileMenuOpen(false);
    }
  };

  const linkCls = (key: SiteHeaderProps['activePage']) => `site-nav-link${activePage === key ? ' active' : ''}`;
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link to="/" className="site-logo" onClick={closeMobileMenu}>
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
        <Link to="/" className="site-drawer-logo-wrap" onClick={closeMobileMenu}>
          <img src="/logo.jpeg" alt="Inanhxink" className="site-drawer-logo" />
          <span className="site-drawer-logo-text">In Ảnh Xink</span>
        </Link>
        {flags.page_qr_yeu_thuong     && <Link to="/qr-yeu-thuong"     className={linkCls('qr-yeu-thuong')} onClick={closeMobileMenu}>QR Yêu Thương</Link>}
        {flags.page_thiep             && <Link to="/thiep"             className={linkCls('thiep')} onClick={closeMobileMenu}>Thiệp</Link>}
        {flags.page_khung_anh         && <Link to="/khung-anh"         className={linkCls('khung-anh')} onClick={closeMobileMenu}>Khung Ảnh</Link>}
        {flags.page_so_scrapbook      && <Link to="/so-scrapbook"      className={linkCls('so-scrapbook')} onClick={closeMobileMenu}>Sổ &amp; Scrapbook</Link>}
        {flags.page_set_qua_tang      && <Link to="/set-qua-tang"      className={linkCls('set-qua-tang')} onClick={closeMobileMenu}>Set Quà Tặng</Link>}
        {flags.page_cac_san_pham_khac && <Link to="/cac-san-pham-khac" className={linkCls('cac-san-pham-khac')} onClick={closeMobileMenu}>Các Sản Phẩm Khác</Link>}
        {flags.page_in_anh            && <Link to="/in-anh"            className={linkCls('in-anh')} onClick={closeMobileMenu}>In Ảnh</Link>}
        <Link to="/danh-gia" className={linkCls('danh-gia')} onClick={closeMobileMenu}>Feedback</Link>
      </nav>
    </header>
  );
}

export default SiteHeader;

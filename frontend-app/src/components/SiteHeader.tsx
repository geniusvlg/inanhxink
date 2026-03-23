import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.jpeg';
import './SiteHeader.css';

interface SiteHeaderProps {
  activePage?: 'qr-yeu-thuong' | 'thiep' | 'khung-anh';
}

function SiteHeader({ activePage }: SiteHeaderProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link to="/" className="site-logo">
          <img src={logo} alt="Inanhxink" className="site-logo-img" />
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
      </div>

      <nav className="site-header-nav">
        <Link to="/qr-yeu-thuong" className={`site-nav-link${activePage === 'qr-yeu-thuong' ? ' active' : ''}`}>QR Yêu Thương</Link>
        <Link to="/thiep" className={`site-nav-link${activePage === 'thiep' ? ' active' : ''}`}>Thiệp</Link>
        <Link to="/khung-anh" className={`site-nav-link${activePage === 'khung-anh' ? ' active' : ''}`}>Khung Ảnh</Link>
      </nav>
    </header>
  );
}

export default SiteHeader;

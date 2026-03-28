import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProductById, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './ProductDetailPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('vi-VN') + 'đ';
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProductById(Number(id))
      .then((p) => { setProduct(p); setActiveImg(0); })
      .catch(() => setError('Không thể tải sản phẩm'))
      .finally(() => setLoading(false));
  }, [id]);

  const backPath = product?.type === 'khung_anh' ? '/khung-anh' : '/thiep';
  const backLabel = product?.type === 'khung_anh' ? 'Khung Ảnh' : 'Thiệp';

  const images = product?.images?.length
    ? product.images.map((img) => `${API_BASE_URL}${img}`)
    : ['/placeholder.png'];

  if (loading) {
    return (
      <div className="pd-page">
        <SiteHeader />
        <div className="pd-loading">Đang tải...</div>
        <SiteFooter />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="pd-page">
        <SiteHeader />
        <div className="pd-error">{error || 'Không tìm thấy sản phẩm'}</div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="pd-page">
      <SiteHeader />

      <main className="pd-main">
        {/* Breadcrumb */}
        <nav className="pd-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span className="pd-breadcrumb-sep">›</span>
          <Link to={backPath}>{backLabel}</Link>
          <span className="pd-breadcrumb-sep">›</span>
          <span>{product.name}</span>
        </nav>

        <div className="pd-body">
          {/* ── Left: image gallery ── */}
          <div className="pd-gallery">
            <div className="pd-thumbnails">
              {images.map((src, i) => (
                <button
                  key={i}
                  className={`pd-thumb-btn${activeImg === i ? ' active' : ''}`}
                  onClick={() => setActiveImg(i)}
                >
                  <img src={src} alt={`${product.name} ${i + 1}`} />
                </button>
              ))}
            </div>
            <div className="pd-main-img-wrap">
              <img
                className="pd-main-img"
                src={images[activeImg]}
                alt={product.name}
              />
              {images.length > 1 && (
                <>
                  <button
                    className="pd-arrow pd-arrow--prev"
                    onClick={() => setActiveImg((activeImg - 1 + images.length) % images.length)}
                    aria-label="Ảnh trước"
                  >‹</button>
                  <button
                    className="pd-arrow pd-arrow--next"
                    onClick={() => setActiveImg((activeImg + 1) % images.length)}
                    aria-label="Ảnh sau"
                  >›</button>
                </>
              )}
            </div>
          </div>

          {/* ── Right: info panel ── */}
          <div className="pd-info">
            <h1 className="pd-name">{product.name}</h1>
            <div className="pd-price">{formatPrice(product.price)}</div>

            {product.description && (
              <p className="pd-desc">{product.description}</p>
            )}

            <a
              className="pd-zalo-btn"
              href="https://zalo.me/0582818580"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img src="/zalo_icon.svg.webp" alt="Zalo" className="pd-zalo-icon" />
              Liên hệ qua Zalo
            </a>

            <div className="pd-divider" />

            {/* Feature badges */}
            <div className="pd-badges">
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span>Thiết kế<br/><strong>Độc Đáo</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="3" width="15" height="13" rx="2"/>
                  <path d="M16 8l5 3-5 3V8z"/>
                </svg>
                <span>Giao hàng<br/><strong>Toàn Quốc</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <span>Làm với<br/><strong>Tâm Huyết</strong></span>
              </div>
              <div className="pd-badge">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fe2c56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>Khách hàng<br/><strong>Hài Lòng</strong></span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

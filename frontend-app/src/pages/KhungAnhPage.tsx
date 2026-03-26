import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './KhungAnhPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

function KhungAnhPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProducts('khung_anh')
      .then(setProducts)
      .catch(() => setError('Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="khuganh-page">
      <SiteHeader activePage="khung-anh" />

      <section className="khuganh-hero">
        <h1 className="khuganh-hero-title">Khung Ảnh <span>Đẹp</span></h1>
        <p className="khuganh-hero-desc">Trang trí ảnh của bạn với những khung ảnh độc đáo và ý nghĩa.</p>
      </section>

      <section className="khuganh-content">
        {loading && <div className="khuganh-loading">Đang tải...</div>}
        {error && <div className="khuganh-error">{error}</div>}

        {!loading && !error && (
          <div className="khuganh-grid">
            {products.length === 0 && (
              <p className="khuganh-empty">Chưa có sản phẩm nào.</p>
            )}
            {products.map((p) => (
              <Link key={p.id} to={`/product/${p.id}`} className="product-card product-card--link">
                <div className="product-card-img-wrap">
                  <img
                    className="product-card-img"
                    src={p.images?.[0] ? `${API_BASE_URL}${p.images[0]}` : '/placeholder.png'}
                    alt={p.name}
                  />
                </div>
                <div className="product-card-info">
                  <div className="product-card-name">{p.name}</div>
                  <div className="product-card-price">{formatPrice(p.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

export default KhungAnhPage;

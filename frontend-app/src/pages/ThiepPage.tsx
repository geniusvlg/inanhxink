import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, type Product } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './ThiepPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

function ThiepPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProducts('thiep')
      .then(setProducts)
      .catch(() => setError('Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="thiep-page">
      <SiteHeader activePage="thiep" />

      <section className="thiep-hero">
        <h1 className="thiep-hero-title">Thiệp <span>Của Bạn</span></h1>
        <p className="thiep-hero-desc">Tạo thiệp cá nhân độc đáo, gửi trao yêu thương đến người thân.</p>
      </section>

      <section className="thiep-content">
        {loading && <div className="thiep-loading">Đang tải...</div>}
        {error && <div className="thiep-error">{error}</div>}

        {!loading && !error && (
          <div className="thiep-grid">
            {products.length === 0 && (
              <p className="thiep-empty">Chưa có sản phẩm nào.</p>
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

export default ThiepPage;

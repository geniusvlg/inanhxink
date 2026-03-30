import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTemplates } from '../services/api';
import { type Template } from '../data/mockTemplates';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './HomePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DEMO_URLS: Record<string, string> = {
  loveletter: 'https://699c2a78976d58f0a2724a1c--timely-otter-19f794.netlify.app/',
  galaxy: 'https://699c370a8c460f27315a8ef6--letterinspace.netlify.app/',
};

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

function HomePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getTemplates()
      .then((data) => {
        const list: Template[] = data.templates || data;
        setTemplates(list.filter((t) => t.is_active));
      })
      .catch(() => setError('Không thể tải danh sách sản phẩm'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="homepage">
      <SiteHeader />

      <section className="homepage-hero">
        <h1 className="homepage-hero-title">
          A Gift <span>For You</span>
        </h1>
        <p className="homepage-hero-desc">
          Tạo trang web cá nhân với mã QR độc đáo — món quà ý nghĩa dành tặng người thân yêu.
        </p>
      </section>

      <section className="homepage-products">
        <h2 className="homepage-section-title">Sản phẩm</h2>

        {loading && <PageLoader />}
        {error && <div className="homepage-error">{error}</div>}

        {!loading && !error && (
          <div className="homepage-grid">
            {templates.map((t) => (
              <div key={t.id} className="product-card">
                <img
                  className="product-card-img"
                  src={t.image_url ? `${API_BASE_URL}${t.image_url}` : '/placeholder.png'}
                  alt={t.name}
                />
                <div className="product-card-body">
                  <div className="product-card-name">{t.name}</div>
                  <div className="product-card-price">{formatPrice(t.price)}</div>
                  <div className="product-card-actions">
                    {DEMO_URLS[t.template_type] && (
                      <a href={DEMO_URLS[t.template_type]} className="btn-detail" target="_blank" rel="noopener noreferrer">
                        Demo
                      </a>
                    )}
                    <Link to={`/order?template=${t.id}`} className="btn-buy">
                      Mua Ngay
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}

export default HomePage;

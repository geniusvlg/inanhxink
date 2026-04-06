import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTemplates } from '../services/api';
import { type Template } from '../data/mockTemplates';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './QrYeuThuongPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

function QrYeuThuongPage() {
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
    <div className="qryt-page">
      <SiteHeader activePage="qr-yeu-thuong" />

      <section className="qryt-hero">
        <h1 className="qryt-hero-title">QR <span>Yêu Thương</span></h1>
        <p className="qryt-hero-desc">
          Tạo trang web cá nhân với mã QR độc đáo — món quà ý nghĩa dành tặng người thân yêu.
        </p>
      </section>

      <section className="qryt-products">
        <h2 className="qryt-section-title">Sản phẩm</h2>

        {loading && <PageLoader />}
        {error && <div className="qryt-error">{error}</div>}

        {!loading && !error && (
          <div className="qryt-grid">
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
                    {t.demo_url && (
                      <a href={t.demo_url} className="btn-detail" target="_blank" rel="noopener noreferrer">
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

export default QrYeuThuongPage;

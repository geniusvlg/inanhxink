import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getTemplates } from '../services/api';
import { type Template } from '../data/mockTemplates';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import { resolveAssetUrl } from '../utils/assetUrl';
import './QrYeuThuongPage.css';

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

      <main className="qryt-products">
        {!loading && !error && (
          <div className="pf-result-bar">Đang hiển thị {templates.length} template</div>
        )}
        {loading && <PageLoader />}
        {error && <div className="qryt-error">{error}</div>}

        {!loading && !error && (
          <div className="qryt-grid">
            {templates.length === 0 && (
              <div className="qryt-empty">Hiện chưa có template QR nào.</div>
            )}
            {templates.map((t) => (
              <article key={t.id} className="product-card product-card--link qryt-card">
                <Link to={`/order?template=${t.id}`} className="qryt-card-main">
                  <div className="product-card-img-wrap">
                    <img
                      className="product-card-img"
                      src={resolveAssetUrl(t.image_url)}
                      alt={t.name}
                    />
                  </div>
                  <div className="product-card-info">
                    <div className="product-card-name">{t.name}</div>
                    <div className="product-card-price">{formatPrice(t.price)}</div>
                  </div>
                </Link>
                <div className="product-card-actions qryt-card-actions">
                  {t.demo_url && (
                    <a href={t.demo_url} className="btn-detail" target="_blank" rel="noopener noreferrer">
                      Demo
                    </a>
                  )}
                  <Link to={`/order?template=${t.id}`} className="btn-buy">
                    Mua Ngay
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

export default QrYeuThuongPage;

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getFeaturedProducts,
  getBanners,
  getTestimonials,
  type Banner,
  type Product,
  type Testimonial,
} from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import BannerCarousel from '../components/BannerCarousel';
import FeaturedFeedback from '../components/FeaturedFeedback';
import './HomePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function formatPrice(price: number): string {
  return Math.round(price).toLocaleString('en') + 'đ';
}

function imageSrc(url: string | null | undefined): string {
  if (!url) return '/placeholder.png';
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
}

/** Slight, deterministic rotation per index — keeps the polaroid feel without
 *  randomness causing layout jitter on re-render. */
const TILTS = ['-1.2deg', '0.8deg', '-0.6deg', '1.4deg'];
const tiltFor = (i: number) => TILTS[i % TILTS.length];

function HomePage() {
  const [products, setProducts]         = useState<Product[]>([]);
  const [banners, setBanners]           = useState<Banner[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');

  useEffect(() => {
    // Featured products failure is the only blocking error; banners + feedback
    // simply render empty if their fetch fails.
    Promise.all([
      getFeaturedProducts().then(setProducts),
      getBanners().then(setBanners).catch(() => setBanners([])),
      getTestimonials().then(setTestimonials).catch(() => setTestimonials([])),
    ])
      .catch(() => setError('Không thể tải sản phẩm trang chủ'))
      .finally(() => setLoading(false));
  }, []);

  // Hero polaroid collage uses the first 3 featured products as preview shots.
  const heroShots = products.slice(0, 3);

  return (
    <div className="homepage">
      <SiteHeader activePage="home" />

      {banners.length > 0 && (
        <section className="homepage-banner-section">
          <BannerCarousel banners={banners} />
        </section>
      )}

      {/* Cute hero always renders — when a banner is also shown above, the
          hero gets slightly tighter top padding so the two sections breathe
          together instead of stacking heavily. */}
      <section
        className={`homepage-hero${banners.length > 0 ? ' homepage-hero--with-banner' : ''}`}
      >
          <div className="hero-inner">
            <div className="hero-copy">
              <img
                src="/watermark.png"
                alt="in ảnh xink"
                className="hero-eyebrow-mark"
              />
              <h1 className="hero-title">
                Một món quà <span>nhỏ xinh,</span>
                <br />
                cho người mình thương.
              </h1>
              <p className="hero-desc">
                Tự tay thiết kế web kỉ niệm, thiệp, khung ảnh… gói trọn ký ức vào một mã QR
                hoặc một trang riêng dành tặng người ấy.
              </p>
              <div className="hero-ctas">
                {/* Same-page scroll to the featured products grid below.
                    Using a button (not a Link) avoids react-router treating
                    "#products" as a route path and landing on a 404. */}
                <button
                  type="button"
                  className="hero-btn hero-btn-primary"
                  onClick={() => {
                    document
                      .getElementById('products')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Khám phá ngay
                </button>
                <Link to="/danh-gia" className="hero-btn hero-btn-ghost">
                  Xem feedback
                </Link>
              </div>
            </div>

            <div className="hero-collage" aria-hidden="true">
              {heroShots.map((p, i) => (
                <div
                  key={p.id}
                  className={`polaroid polaroid-${i}`}
                  style={{ ['--tilt' as string]: tiltFor(i) }}
                >
                  <img src={imageSrc(p.images?.[0])} alt="" />
                  <div className="polaroid-cap">{p.name}</div>
                </div>
              ))}
              {heroShots.length === 0 && (
                <div className="polaroid polaroid-0" style={{ ['--tilt' as string]: '-2deg' }}>
                  <img src="/logo.jpeg" alt="" />
                  <div className="polaroid-cap">in ảnh xink ♥</div>
                </div>
              )}
            </div>
          </div>

        </section>

      <section id="products" className="homepage-products">
        <h2 className="homepage-section-title">
          Sản phẩm yêu thích nhất <span className="homepage-section-title-mark">♥</span>
        </h2>

        {loading && <PageLoader />}
        {error && <div className="homepage-error">{error}</div>}

        {!loading && !error && products.length > 0 && (
          <div className="homepage-grid">
            {products.map((p, i) => (
              <Link
                key={p.id}
                to={`/product/${p.id}`}
                className="poly-card"
                style={{ ['--tilt' as string]: tiltFor(i) }}
              >
                <div className="poly-card-frame">
                  <img
                    className="poly-card-img"
                    src={imageSrc(p.images?.[0])}
                    alt={p.name}
                    loading="lazy"
                  />
                </div>
                <div className="poly-card-cap">
                  <div className="poly-card-name">{p.name}</div>
                  <div className="poly-card-price">{formatPrice(p.price)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {!loading && <FeaturedFeedback testimonials={testimonials} />}

      <SiteFooter />
    </div>
  );
}

export default HomePage;

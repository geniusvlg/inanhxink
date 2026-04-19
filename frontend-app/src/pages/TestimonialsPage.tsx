import { useEffect, useState } from 'react';
import { getTestimonials, type Testimonial, type TestimonialPlatform } from '../services/api';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './TestimonialsPage.css';

const PLATFORM_LABEL: Record<TestimonialPlatform, string> = {
  tiktok:    'TikTok',
  zalo:      'Zalo',
  instagram: 'Instagram',
  other:     'Khác',
};

export default function TestimonialsPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState<Testimonial | null>(null);

  useEffect(() => {
    getTestimonials()
      .then(setItems)
      .catch(() => setError('Không thể tải đánh giá'))
      .finally(() => setLoading(false));
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  return (
    <div className="testimonials-page">
      <SiteHeader activePage="danh-gia" />

      <section className="testimonials-page-hero">
        <h1 className="testimonials-page-title">Khách hàng nghĩ gì về tụi mình</h1>
        <p className="testimonials-page-subtitle">
          Những lời đánh giá thật từ khách hàng trên TikTok, Zalo, Instagram
        </p>
      </section>

      <section className="testimonials-page-content">
        {loading && <PageLoader />}
        {error && <div className="testimonials-page-error">{error}</div>}

        {!loading && !error && items.length === 0 && (
          <div className="testimonials-page-empty">
            Chưa có đánh giá nào — quay lại sau nhé!
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="testimonials-masonry">
            {items.map(t => (
              <button
                type="button"
                key={t.id}
                className={`masonry-card${t.is_featured ? ' masonry-card--featured' : ''}`}
                onClick={() => setLightbox(t)}
              >
                <div className="masonry-img-wrap">
                  <img
                    src={t.image_url}
                    alt={t.caption ?? 'Đánh giá khách hàng'}
                    loading="lazy"
                  />
                  <span className={`masonry-platform-badge platform-${t.platform}`}>
                    {PLATFORM_LABEL[t.platform]}
                  </span>
                  {t.is_featured && (
                    <span className="masonry-featured-badge" aria-label="Nổi bật">⭐</span>
                  )}
                </div>
                {(t.reviewer_name || t.caption) && (
                  <div className="masonry-meta">
                    {t.reviewer_name && <div className="masonry-name">{t.reviewer_name}</div>}
                    {t.caption && <div className="masonry-caption">{t.caption}</div>}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {lightbox && (
        <div className="testimonial-lightbox" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="testimonial-lightbox-close"
            onClick={() => setLightbox(null)}
            aria-label="Đóng"
          >×</button>
          <img
            src={lightbox.image_url}
            alt={lightbox.caption ?? ''}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      <SiteFooter />
    </div>
  );
}

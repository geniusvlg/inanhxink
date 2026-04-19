import { useEffect, useState } from 'react';
import { getTestimonialsPaginated, type Testimonial } from '../services/api';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import './TestimonialsPage.css';

export default function TestimonialsPage() {
  const { testimonials_page_size } = useFeatureFlags();

  const [items, setItems]             = useState<Testimonial[]>([]);
  const [page, setPage]               = useState(1);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState('');
  const [lightbox, setLightbox]       = useState<Testimonial | null>(null);

  // Mirrors the product-list pages (ThiepPage etc.) — incremental
  // "Load more" appends new pages to the existing array. The backend
  // honours `page_size` from the admin-configurable
  // `testimonials_page_size` metadata key.
  useEffect(() => {
    const isFirstPage = page === 1;
    if (isFirstPage) { setLoading(true); setItems([]); }
    else             { setLoadingMore(true); }
    setError('');

    getTestimonialsPaginated({ page, page_size: testimonials_page_size })
      .then(data => {
        setTotal(data.total);
        setItems(prev => isFirstPage ? data.testimonials : [...prev, ...data.testimonials]);
      })
      .catch(() => setError('Không thể tải đánh giá'))
      .finally(() => { setLoading(false); setLoadingMore(false); });
  }, [page, testimonials_page_size]);

  // If the admin shrinks the page size, reset the cursor so we don't
  // sit on a now-impossible page number.
  useEffect(() => {
    setPage(1);
  }, [testimonials_page_size]);

  // Close lightbox on Escape
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  const hasMore = items.length < total;

  return (
    <div className="testimonials-page">
      <SiteHeader activePage="danh-gia" />

      <section className="testimonials-page-hero">
        <h1 className="testimonials-page-title">Khách hàng nghĩ gì về tụi mình</h1>
        <p className="testimonials-page-subtitle">
          Những lời đánh giá thật từ khách hàng đã mua sản phẩm
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
          <>
            <div className="testimonials-result-bar">
              Đang hiển thị {items.length} / {total} đánh giá
            </div>

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

            {hasMore && (
              <div className="load-more-wrap">
                {loadingMore ? (
                  <img src="/load_more.gif" alt="Đang tải" className="load-more-icon" />
                ) : (
                  <button
                    className="load-more-btn"
                    onClick={() => setPage(p => p + 1)}
                  >
                    Tải thêm ↓
                  </button>
                )}
              </div>
            )}
          </>
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

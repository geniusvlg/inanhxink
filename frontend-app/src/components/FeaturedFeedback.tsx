import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Testimonial, type TestimonialPlatform } from '../services/api';
import './FeaturedFeedback.css';

const PLATFORM_LABEL: Record<TestimonialPlatform, string> = {
  tiktok:    'TikTok',
  zalo:      'Zalo',
  instagram: 'Instagram',
  other:     'Khác',
};

interface Props {
  /** All testimonials — the section internally picks featured ones (or
   *  falls back to the most recent if there are no featured rows). */
  testimonials: Testimonial[];
  /** Max number of cards to display. */
  limit?: number;
}

export default function FeaturedFeedback({ testimonials, limit = 12 }: Props) {
  const [lightbox, setLightbox] = useState<Testimonial | null>(null);

  const featured = testimonials.filter(t => t.is_featured);
  const display  = (featured.length > 0 ? featured : testimonials).slice(0, limit);

  if (display.length === 0) return null;

  return (
    <section className="featured-feedback">
      <div className="ff-header">
        <h2 className="ff-title">
          <span className="ff-title-mark">♥</span> Khách hàng yêu tụi mình
        </h2>
        <p className="ff-subtitle">
          Những lời đánh giá thật từ khách hàng trên TikTok, Zalo, Instagram
        </p>
      </div>

      <div className="ff-grid">
        {display.map(t => (
          <button
            type="button"
            key={t.id}
            className="ff-card"
            onClick={() => setLightbox(t)}
          >
            <div className="ff-card-img-wrap">
              <img
                src={t.image_url}
                alt={t.caption ?? 'Đánh giá khách hàng'}
                loading="lazy"
              />
              <span className={`ff-platform ff-platform-${t.platform}`}>
                {PLATFORM_LABEL[t.platform]}
              </span>
            </div>
            {(t.reviewer_name || t.caption) && (
              <div className="ff-card-meta">
                {t.reviewer_name && <div className="ff-card-name">{t.reviewer_name}</div>}
                {t.caption && <div className="ff-card-caption">{t.caption}</div>}
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="ff-cta-wrap">
        <Link to="/danh-gia" className="ff-cta">
          Xem tất cả đánh giá →
        </Link>
      </div>

      {lightbox && (
        <div className="ff-lightbox" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="ff-lightbox-close"
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
    </section>
  );
}

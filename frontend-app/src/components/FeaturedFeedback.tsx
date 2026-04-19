import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type Testimonial } from '../services/api';
import './FeaturedFeedback.css';

interface Props {
  /** All testimonials — the section displays only those flagged for the
   *  homepage (`is_featured_on_home`). Admins curate which ones appear here
   *  separately from the masonry /danh-gia page. */
  testimonials: Testimonial[];
  /** Max number of cards to display. */
  limit?: number;
}

export default function FeaturedFeedback({ testimonials, limit = 12 }: Props) {
  const [lightbox, setLightbox] = useState<Testimonial | null>(null);

  const display = testimonials
    .filter(t => t.is_featured_on_home)
    .slice(0, limit);

  if (display.length === 0) return null;

  return (
    <section className="featured-feedback">
      <div className="ff-header">
        <h2 className="ff-title">
          <span className="ff-title-mark">♥</span> Khách hàng yêu tụi mình
        </h2>
        <p className="ff-subtitle">
          Những lời đánh giá thật từ khách hàng đã mua sản phẩm
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
            </div>
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

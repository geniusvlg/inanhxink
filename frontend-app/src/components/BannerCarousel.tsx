import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type Banner } from '../services/api';
import './BannerCarousel.css';

interface Props {
  banners: Banner[];
  /** Auto-rotate interval (ms). Set to 0 to disable. */
  intervalMs?: number;
}

/** Returns true for in-app paths (start with `/` and aren't a protocol URL). */
function isInternalLink(url: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  return false;
}

export default function BannerCarousel({ banners, intervalMs = 5000 }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => { setIndex(0); }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1 || intervalMs <= 0 || paused) return;
    timerRef.current = window.setInterval(() => {
      setIndex(i => (i + 1) % banners.length);
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [banners.length, intervalMs, paused]);

  if (banners.length === 0) return null;

  const renderSlide = (b: Banner) => {
    const img = (
      <img
        src={b.image_url}
        alt={b.alt_text ?? ''}
        className="banner-slide-img"
        draggable={false}
      />
    );
    if (!b.link_url) return img;
    if (isInternalLink(b.link_url)) {
      return <Link to={b.link_url} className="banner-slide-link">{img}</Link>;
    }
    return (
      <a href={b.link_url} className="banner-slide-link" target="_blank" rel="noopener noreferrer">
        {img}
      </a>
    );
  };

  return (
    <div
      className="banner-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Banner trang chủ"
    >
      <div
        className="banner-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map(b => (
          <div className="banner-slide" key={b.id}>{renderSlide(b)}</div>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            className="banner-arrow banner-arrow--prev"
            aria-label="Banner trước"
            onClick={() => setIndex(i => (i - 1 + banners.length) % banners.length)}
          >‹</button>
          <button
            type="button"
            className="banner-arrow banner-arrow--next"
            aria-label="Banner sau"
            onClick={() => setIndex(i => (i + 1) % banners.length)}
          >›</button>

          <div className="banner-dots" role="tablist">
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                className={`banner-dot${i === index ? ' banner-dot--active' : ''}`}
                aria-label={`Banner ${i + 1}`}
                aria-selected={i === index}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

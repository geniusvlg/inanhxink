import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProductBanner, type ProductPageSlug, type ProductBannerSlide } from '../contexts/FeatureFlagsContext';
import './ProductPageBanner.css';

interface Props {
  page: ProductPageSlug;
  /** Auto-rotate interval (ms). Set to 0 to disable. */
  intervalMs?: number;
}

/** True for in-app paths (start with `/` and aren't protocol-relative). */
function isInternalLink(url: string | undefined): url is string {
  if (!url) return false;
  return url.startsWith('/') && !url.startsWith('//');
}

/** Smaller cousin of {@link BannerCarousel}: a 16:4, max-960px-wide image
 *  carousel mounted at the top of each product-page hero. Single slide → no
 *  dots / no auto-rotate; multiple slides → fades between with dots. */
export default function ProductPageBanner({ page, intervalMs = 5000 }: Props) {
  const slides = useProductBanner(page);
  const [index, setIndex]   = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef            = useRef<number | null>(null);

  const count = slides?.length ?? 0;

  useEffect(() => { setIndex(0); }, [count]);

  useEffect(() => {
    if (count <= 1 || intervalMs <= 0 || paused) return;
    timerRef.current = window.setInterval(() => {
      setIndex(i => (i + 1) % count);
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [count, intervalMs, paused]);

  if (!slides || count === 0) return null;

  const renderSlide = (s: ProductBannerSlide, i: number) => {
    const img = (
      <img
        src={s.imageUrl}
        alt=""
        className="ppb-slide-img"
        draggable={false}
        loading={i === 0 ? 'eager' : 'lazy'}
      />
    );
    if (!s.linkUrl) return img;
    if (isInternalLink(s.linkUrl)) {
      return <Link to={s.linkUrl} className="ppb-slide-link" aria-label="Mở liên kết">{img}</Link>;
    }
    return (
      <a
        href={s.linkUrl}
        className="ppb-slide-link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Mở liên kết"
      >
        {img}
      </a>
    );
  };

  return (
    <div
      className="ppb"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="region"
      aria-label="Banner trang sản phẩm"
    >
      <div
        className="ppb-track"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {slides.map((s, i) => (
          <div className="ppb-slide" key={`${s.imageUrl}-${i}`}>{renderSlide(s, i)}</div>
        ))}
      </div>

      {count > 1 && (
        <div className="ppb-dots" role="tablist">
          {slides.map((s, i) => (
            <button
              key={`dot-${s.imageUrl}-${i}`}
              type="button"
              className={`ppb-dot${i === index ? ' ppb-dot--active' : ''}`}
              aria-label={`Slide ${i + 1}`}
              aria-selected={i === index}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

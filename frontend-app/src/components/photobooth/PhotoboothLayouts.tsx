import { useEffect, useRef, useState } from 'react';
import { LAYOUTS, type LayoutId, type PhotoboothLayout } from '../../utils/photobooth';

interface PhotoboothLayoutsProps {
  onPick: (layout: PhotoboothLayout) => void;
}

const BADGE: Record<string, string> = {
  try: 'THỬ NGAY',
  new: 'MẪU MỚI',
  template: 'MẪU CÓ SẴN',
  holiday: 'ĐẶC BIỆT LỄ',
};

const PREVIEW: Record<LayoutId, string> = {
  a: '/photobooth/layouts/a.webp',
  b: '/photobooth/layouts/b.webp',
  idcard: '/photobooth/layouts/idcard.png',
  hearts: '/photobooth/layouts/hearts.png',
  dog: '/photobooth/layouts/dog.jpg',
  vintage: '/photobooth/layouts/vintage.webp',
  solace: '/photobooth/layouts/solace.webp',
  classic: '/photobooth/layouts/classic.webp',
  love: '/photobooth/layouts/love.webp',
  holidays: '/photobooth/layouts/holidays.webp',
  c: '/photobooth/layouts/c.webp',
  d: '/photobooth/layouts/d.webp',
  e: '/photobooth/layouts/e.webp',
};

function StripPreview({ layout }: { layout: PhotoboothLayout }) {
  return (
    <img
      className={`pb-strip-photo cols-${layout.columns} theme-${layout.theme}`}
      src={PREVIEW[layout.id]}
      alt=""
    />
  );
}

export default function PhotoboothLayouts({ onPick }: PhotoboothLayoutsProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const syncArrows = () => {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });
    window.addEventListener('resize', syncArrows);
    return () => {
      el.removeEventListener('scroll', syncArrows);
      window.removeEventListener('resize', syncArrows);
    };
  }, []);

  const scrollBy = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 240, behavior: 'smooth' });
  };

  return (
    <section className="pb-layouts">
      <div className="pb-layouts-glow" />
      <h1 className="pb-layouts-title">chọn mẫu ảnh</h1>
      <p className="pb-layouts-sub">Chọn một mẫu photobooth bạn thích</p>

      <div className="pb-layouts-carousel">
        <button
          type="button"
          className="pb-layouts-arrow"
          aria-label="Mẫu trước"
          disabled={!canLeft}
          onClick={() => scrollBy(-1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div className="pb-layouts-scroll" ref={scroller}>
          <div className="pb-layouts-row">
            {LAYOUTS.map(layout => (
              <button
                key={layout.id}
                type="button"
                className="pb-layout-item"
                onClick={() => onPick(layout)}
              >
                <div className="pb-layout-preview-wrap">
                  {layout.badge && (
                    <span className={`pb-layout-badge pb-layout-badge--${layout.badge}`}>
                      {BADGE[layout.badge]}
                    </span>
                  )}
                  <StripPreview layout={layout} />
                </div>
                <h2>{layout.name}</h2>
                <p>{layout.sizeLabel}</p>
                <p>({layout.poseLabel})</p>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="pb-layouts-arrow"
          aria-label="Mẫu tiếp"
          disabled={!canRight}
          onClick={() => scrollBy(1)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}

export type { LayoutId };

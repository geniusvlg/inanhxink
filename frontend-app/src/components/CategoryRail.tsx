import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getCategories, type Category } from '../services/api';
import './CategoryRail.css';

const MAX_VISIBLE = 10;

// Instagram-highlight-style entry points into /danh-muc/:id. Renders nothing
// until categories are loaded, and nothing at all if there are none yet.
export default function CategoryRail() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoaded(true));
  }, []);

  // The right-edge fade is only a "there's more, scroll →" hint — only show
  // it once the rail actually overflows, otherwise it's a fade to nothing.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const checkOverflow = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded, categories.length]);

  if (!loaded || categories.length === 0) return null;

  const visible = categories.slice(0, MAX_VISIBLE);

  return (
    <div className="cat-rail-wrap">
      <div className={`cat-rail${overflowing ? '' : ' cat-rail--centered'}`} ref={railRef}>
        {visible.map(c => (
          <Link key={c.id} to={`/danh-muc/${c.id}`} className="cat-rail-item">
            <span className="cat-rail-ring">
              <span className="cat-rail-photo">
                {c.cover_image_url
                  ? <img src={c.cover_image_url} alt="" loading="lazy" />
                  : <span className="cat-rail-fallback">{c.name.trim().charAt(0).toUpperCase()}</span>}
              </span>
            </span>
            <span className="cat-rail-label">{c.name}</span>
          </Link>
        ))}
      </div>
      {overflowing && <div className="cat-rail-fade" aria-hidden="true" />}
    </div>
  );
}

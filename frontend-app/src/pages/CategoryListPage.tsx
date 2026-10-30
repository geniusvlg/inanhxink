import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import PageLoader from '../components/PageLoader';
import { getCategories, type Category } from '../services/api';
import '../components/CategoryRail.css';
import './CategoryListPage.css';

export default function CategoryListPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then(list => { if (!cancelled) setCategories(list); })
      .catch(() => { if (!cancelled) setError('Không thể tải danh mục'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="ps-page">
      <SiteHeader />
      <main className="ps-main">
        <button type="button" className="ps-back" onClick={() => navigate(-1)}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M12.5 5L7.5 10L12.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Quay lại
        </button>

        <h1 className="ps-heading">
          Danh mục {!loading && !error && <span className="ps-count">({categories.length})</span>}
        </h1>

        {loading && <PageLoader />}
        {error && <div className="ps-error">{error}</div>}

        {!loading && !error && categories.length === 0 && (
          <p className="ps-empty">Chưa có danh mục nào.</p>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="cat-list-grid">
            {categories.map(c => (
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
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
